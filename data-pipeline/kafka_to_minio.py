"""
kafka_to_minio.py — AquaFlow data-lake archival pipeline
=========================================================
Consumes sensor readings from Kafka topic `sensors.readings`,
batches them, and writes Parquet files to MinIO under:

  aquaflow-lake/raw/sensors/
      year=YYYY/month=MM/day=DD/station=<station_id>/
          <ISO_timestamp>_<batch_id>.parquet

Hive-style partitioning allows Spark (Tasks 9-10) to read
efficiently by filtering on year/month/day/station predicates.

Flush strategy (whichever triggers first):
  • BATCH_SIZE   records accumulated (default: 500)
  • FLUSH_SECS   seconds since last flush (default: 60)

Environment variables:
  KAFKA_BROKERS         comma-separated, e.g. kafka:9092
  KAFKA_GROUP_ID        consumer group (default: aquaflow-lake-archiver)
  KAFKA_TOPIC           topic to consume (default: sensors.readings)
  MINIO_ENDPOINT        e.g. http://minio:9000
  MINIO_ACCESS_KEY
  MINIO_SECRET_KEY
  MINIO_BUCKET          (default: aquaflow-lake)
  BATCH_SIZE            records per Parquet file (default: 500)
  FLUSH_SECS            max seconds between flushes (default: 60)
  LOG_LEVEL             DEBUG | INFO | WARNING (default: INFO)
"""

import io
import json
import logging
import os
import signal
import sys
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import boto3
import pyarrow as pa
import pyarrow.parquet as pq
from botocore.client import Config
from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

# ── Configuration ─────────────────────────────────────────────────────────────

KAFKA_BROKERS   = os.environ.get("KAFKA_BROKERS",   "kafka:9092")
KAFKA_GROUP_ID  = os.environ.get("KAFKA_GROUP_ID",  "aquaflow-lake-archiver")
KAFKA_TOPIC     = os.environ.get("KAFKA_TOPIC",     "sensors.readings")
MINIO_ENDPOINT  = os.environ.get("MINIO_ENDPOINT",  "http://minio:9000")
MINIO_ACCESS_KEY= os.environ.get("MINIO_ACCESS_KEY","aquaflow")
MINIO_SECRET_KEY= os.environ.get("MINIO_SECRET_KEY","aquaflow123")
MINIO_BUCKET    = os.environ.get("MINIO_BUCKET",    "aquaflow-lake")
BATCH_SIZE      = int(os.environ.get("BATCH_SIZE",  "500"))
FLUSH_SECS      = int(os.environ.get("FLUSH_SECS",  "60"))
LOG_LEVEL       = os.environ.get("LOG_LEVEL",       "INFO").upper()

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
    stream=sys.stdout,
)
log = logging.getLogger("kafka_to_minio")

# ── Parquet schema ────────────────────────────────────────────────────────────

SCHEMA = pa.schema([
    pa.field("sensor_id",          pa.string(),      nullable=False),
    pa.field("station_id",         pa.string(),      nullable=True),
    pa.field("type",               pa.string(),      nullable=True),
    pa.field("value",              pa.float64(),     nullable=False),
    pa.field("unit",               pa.string(),      nullable=True),
    pa.field("timestamp",          pa.timestamp("ms", tz="UTC"), nullable=False),
    pa.field("threshold_violated", pa.bool_(),       nullable=False),
    pa.field("ingested_at",        pa.timestamp("ms", tz="UTC"), nullable=False),
])

# ── MinIO client ──────────────────────────────────────────────────────────────

def make_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=MINIO_ENDPOINT,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",   # MinIO ignores region but boto3 requires it
    )

# ── Batch buffer ──────────────────────────────────────────────────────────────

class BatchBuffer:
    """Accumulates parsed sensor-reading dicts until flush criteria are met."""

    def __init__(self):
        self._rows: list[dict[str, Any]] = []
        self._last_flush = time.monotonic()

    def add(self, row: dict[str, Any]) -> None:
        self._rows.append(row)

    def should_flush(self) -> bool:
        if len(self._rows) >= BATCH_SIZE:
            return True
        if (time.monotonic() - self._last_flush) >= FLUSH_SECS:
            return True
        return False

    def drain(self) -> list[dict[str, Any]]:
        rows, self._rows = self._rows, []
        self._last_flush = time.monotonic()
        return rows

    def __len__(self) -> int:
        return len(self._rows)


# ── Parquet writer ────────────────────────────────────────────────────────────

def rows_to_parquet_bytes(rows: list[dict[str, Any]]) -> bytes:
    """Convert a list of row dicts to an in-memory Parquet file (bytes)."""
    now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)

    columns: dict[str, list] = defaultdict(list)
    for r in rows:
        ts_str  = r.get("timestamp", "")
        ts_ms   = _parse_ts_ms(ts_str)

        columns["sensor_id"].append(r.get("sensorId") or r.get("sensor_id", ""))
        columns["station_id"].append(r.get("stationId") or r.get("station_id") or "unknown")
        columns["type"].append(r.get("type", ""))
        columns["value"].append(float(r.get("value", 0.0)))
        columns["unit"].append(r.get("unit", ""))
        columns["timestamp"].append(ts_ms)
        columns["threshold_violated"].append(bool(r.get("thresholdViolated", False)))
        columns["ingested_at"].append(now_ms)

    table = pa.table(columns, schema=SCHEMA)
    buf   = io.BytesIO()
    pq.write_table(
        table, buf,
        compression="snappy",       # fast compression, Spark-compatible
        row_group_size=min(len(rows), 100_000),
    )
    buf.seek(0)
    return buf.read()


def _parse_ts_ms(ts_str: str) -> int:
    """Parse ISO-8601 timestamp to epoch milliseconds."""
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except Exception:
        return int(datetime.now(timezone.utc).timestamp() * 1000)


# ── S3 key builder ────────────────────────────────────────────────────────────

def build_s3_key(station_id: str, batch_ts: datetime, batch_id: str) -> str:
    """
    Hive-partitioned path so Spark can prune by date and station:
      raw/sensors/year=2026/month=06/day=08/station=abc123/
          2026-06-08T00-00-00Z_<uuid>.parquet
    """
    sid = station_id or "unknown"
    return (
        f"raw/sensors/"
        f"year={batch_ts.year:04d}/"
        f"month={batch_ts.month:02d}/"
        f"day={batch_ts.day:02d}/"
        f"station={sid}/"
        f"{batch_ts.strftime('%Y-%m-%dT%H-%M-%SZ')}_{batch_id}.parquet"
    )


# ── Flush logic ───────────────────────────────────────────────────────────────

def flush_batch(s3, rows: list[dict[str, Any]], stats: dict) -> None:
    """Write one Parquet file per distinct station_id in the batch."""
    if not rows:
        return

    # Group by station_id so each file belongs to one station partition
    by_station: dict[str, list] = defaultdict(list)
    for r in rows:
        sid = r.get("stationId") or r.get("station_id") or "unknown"
        by_station[sid].append(r)

    batch_ts = datetime.now(timezone.utc)
    batch_id = uuid.uuid4().hex[:8]
    files_written = 0

    for station_id, station_rows in by_station.items():
        try:
            parquet_bytes = rows_to_parquet_bytes(station_rows)
            key = build_s3_key(station_id, batch_ts, batch_id)
            s3.put_object(
                Bucket=MINIO_BUCKET,
                Key=key,
                Body=parquet_bytes,
                ContentType="application/octet-stream",
            )
            files_written += 1
            log.debug(
                "Wrote %d rows → s3://%s/%s (%d bytes)",
                len(station_rows), MINIO_BUCKET, key, len(parquet_bytes),
            )
        except Exception as exc:
            log.error("Failed to write Parquet for station %s: %s", station_id, exc)

    stats["total_rows"]    += len(rows)
    stats["total_files"]   += files_written
    stats["last_flush_at"]  = batch_ts.isoformat()
    log.info(
        "Flushed %d rows → %d Parquet files | cumulative: %d rows / %d files",
        len(rows), files_written,
        stats["total_rows"], stats["total_files"],
    )


# ── Kafka consumer bootstrap (with retry) ─────────────────────────────────────

def make_consumer(max_retries: int = 12, retry_delay: int = 5) -> KafkaConsumer:
    brokers = [b.strip() for b in KAFKA_BROKERS.split(",")]
    for attempt in range(1, max_retries + 1):
        try:
            consumer = KafkaConsumer(
                KAFKA_TOPIC,
                bootstrap_servers=brokers,
                group_id=KAFKA_GROUP_ID,
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                auto_commit_interval_ms=5_000,
                value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                consumer_timeout_ms=FLUSH_SECS * 1_000,   # unblock poll for flush
                max_poll_records=500,
            )
            log.info(
                "Kafka consumer connected [group=%s, brokers=%s, topic=%s]",
                KAFKA_GROUP_ID, KAFKA_BROKERS, KAFKA_TOPIC,
            )
            return consumer
        except NoBrokersAvailable:
            log.warning(
                "Kafka not reachable (attempt %d/%d) — retrying in %ds …",
                attempt, max_retries, retry_delay,
            )
            time.sleep(retry_delay)

    log.error("Could not connect to Kafka after %d attempts — exiting", max_retries)
    sys.exit(1)


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("AquaFlow Kafka→MinIO archiver starting …")
    log.info("Batch size: %d rows | flush interval: %ds", BATCH_SIZE, FLUSH_SECS)

    s3       = make_s3_client()
    consumer = make_consumer()
    buffer   = BatchBuffer()
    stats    = {"total_rows": 0, "total_files": 0, "last_flush_at": None}

    # Graceful shutdown on SIGTERM / SIGINT
    shutdown = False

    def _handle_signal(sig, _frame):
        nonlocal shutdown
        log.info("Shutdown signal received — flushing remaining buffer …")
        shutdown = True

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT,  _handle_signal)

    log.info("Consumer running — waiting for messages on topic '%s' …", KAFKA_TOPIC)

    try:
        for message in consumer:
            if shutdown:
                break

            try:
                row = message.value
                if isinstance(row, dict):
                    buffer.add(row)
                    log.debug("Buffered message offset=%d (buffer=%d)", message.offset, len(buffer))
            except Exception as exc:
                log.warning("Skipped malformed message offset=%d: %s", message.offset, exc)

            if buffer.should_flush():
                flush_batch(s3, buffer.drain(), stats)

    except Exception as exc:
        log.exception("Consumer loop crashed: %s", exc)
    finally:
        # Final flush of whatever is left in the buffer
        remaining = buffer.drain()
        if remaining:
            log.info("Final flush: %d buffered rows", len(remaining))
            flush_batch(s3, remaining, stats)

        consumer.close()
        log.info(
            "Shutdown complete. Total: %d rows / %d files written.",
            stats["total_rows"], stats["total_files"],
        )


if __name__ == "__main__":
    main()
