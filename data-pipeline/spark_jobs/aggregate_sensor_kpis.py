"""
aggregate_sensor_kpis.py — PySpark batch job: hourly/daily KPI aggregation.

Reads raw Parquet from MinIO aquaflow-lake/raw/sensors/, computes per-sensor
per-time-bucket statistics, then writes:
  • MinIO  → aquaflow-lake/processed/hourly/ and processed/daily/   (Parquet)
  • TimescaleDB → sensor_aggregates table (UPSERT)

Run:
  spark-submit --master spark://spark-master:7077 \
    /opt/spark-jobs/aggregate_sensor_kpis.py [--granularity hourly|daily]
"""

import os
import sys
import argparse
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone

from pyspark.sql import SparkSession, Window
from pyspark.sql import functions as F
from pyspark.sql.types import BooleanType


# ─── Config ──────────────────────────────────────────────────────────────────

MINIO_ENDPOINT  = os.getenv("MINIO_ENDPOINT",  "http://minio:9000")
MINIO_ACCESS    = os.getenv("MINIO_ACCESS_KEY", "aquaflow")
MINIO_SECRET    = os.getenv("MINIO_SECRET_KEY", "aquaflow123")
MINIO_BUCKET    = os.getenv("MINIO_BUCKET",     "aquaflow-lake")

DB_HOST     = os.getenv("DB_HOST",     "postgres")
DB_PORT     = int(os.getenv("DB_PORT", "5432"))
DB_NAME     = os.getenv("DB_NAME",     "aquaflow")
DB_USER     = os.getenv("DB_USER",     "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")


# ─── SparkSession ────────────────────────────────────────────────────────────

def build_spark_session(app_name: str) -> SparkSession:
    return (
        SparkSession.builder
        .appName(app_name)
        .config("spark.hadoop.fs.s3a.endpoint",          MINIO_ENDPOINT)
        .config("spark.hadoop.fs.s3a.access.key",        MINIO_ACCESS)
        .config("spark.hadoop.fs.s3a.secret.key",        MINIO_SECRET)
        .config("spark.hadoop.fs.s3a.path.style.access", "true")
        .config("spark.hadoop.fs.s3a.impl",
                "org.apache.hadoop.fs.s3a.S3AFileSystem")
        .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "false")
        .config("spark.hadoop.fs.s3a.aws.credentials.provider",
                "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider")
        # Reduce shuffle partitions for single-worker dev setup
        .config("spark.sql.shuffle.partitions", "8")
        .getOrCreate()
    )


# ─── Aggregation ─────────────────────────────────────────────────────────────

def compute_kpis(df, granularity: str):
    """
    Groups by (sensor_id, station_id, time_bucket) and computes:
      avg, min, max, stddev, reading_count, anomaly_flag (2-sigma rule).
    """
    if granularity == "hourly":
        bucket_expr = F.date_trunc("hour", F.col("timestamp"))
    else:  # daily
        bucket_expr = F.date_trunc("day",  F.col("timestamp"))

    df = df.withColumn("bucket", bucket_expr)

    # Per-sensor global mean + stddev (used for anomaly threshold)
    window_all = Window.partitionBy("sensor_id")
    df = (
        df
        .withColumn("global_mean",   F.mean("value").over(window_all))
        .withColumn("global_stddev", F.stddev("value").over(window_all))
    )

    agg = (
        df.groupBy("sensor_id", "station_id", "bucket")
        .agg(
            F.avg("value").alias("avg_value"),
            F.min("value").alias("min_value"),
            F.max("value").alias("max_value"),
            F.stddev("value").alias("stddev_value"),
            F.count("*").alias("reading_count"),
            # anomaly_flag: bucket avg exceeds rolling mean + 2σ
            (F.avg("value") > (F.first("global_mean") + 2 * F.first("global_stddev")))
            .cast(BooleanType()).alias("anomaly_flag"),
            F.first("global_mean").alias("rolling_mean"),
            F.first("global_stddev").alias("rolling_stddev"),
        )
        .withColumn("granularity", F.lit(granularity))
        .withColumn("computed_at", F.lit(datetime.now(timezone.utc).isoformat()))
    )
    return agg


def compute_station_health(agg_df):
    """
    Station health score: % of (sensor, bucket) pairs NOT flagged as anomaly.
    Returns df with (station_id, bucket, granularity, health_score).
    """
    station = (
        agg_df.groupBy("station_id", "bucket", "granularity")
        .agg(
            (
                F.sum(F.when(~F.col("anomaly_flag"), 1).otherwise(0))
                / F.count("*")
                * 100
            ).alias("health_score")
        )
    )
    return station


# ─── Postgres UPSERT ─────────────────────────────────────────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sensor_aggregates (
    sensor_id    UUID        NOT NULL,
    station_id   UUID        NOT NULL,
    bucket       TIMESTAMPTZ NOT NULL,
    granularity  VARCHAR(10) NOT NULL,
    avg_value    DOUBLE PRECISION,
    min_value    DOUBLE PRECISION,
    max_value    DOUBLE PRECISION,
    stddev_value DOUBLE PRECISION,
    reading_count BIGINT,
    anomaly_flag BOOLEAN     DEFAULT FALSE,
    rolling_mean  DOUBLE PRECISION,
    rolling_stddev DOUBLE PRECISION,
    computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (sensor_id, bucket, granularity)
);
"""

UPSERT_SQL = """
INSERT INTO sensor_aggregates
    (sensor_id, station_id, bucket, granularity,
     avg_value, min_value, max_value, stddev_value,
     reading_count, anomaly_flag, rolling_mean, rolling_stddev, computed_at)
VALUES %s
ON CONFLICT (sensor_id, bucket, granularity) DO UPDATE SET
    avg_value      = EXCLUDED.avg_value,
    min_value      = EXCLUDED.min_value,
    max_value      = EXCLUDED.max_value,
    stddev_value   = EXCLUDED.stddev_value,
    reading_count  = EXCLUDED.reading_count,
    anomaly_flag   = EXCLUDED.anomaly_flag,
    rolling_mean   = EXCLUDED.rolling_mean,
    rolling_stddev = EXCLUDED.rolling_stddev,
    computed_at    = EXCLUDED.computed_at;
"""


def upsert_to_postgres(rows):
    """Called once per Spark partition (via foreachPartition)."""
    if not rows:
        return
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
    )
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(CREATE_TABLE_SQL)
                batch = [
                    (
                        str(r.sensor_id), str(r.station_id),
                        r.bucket.isoformat() if hasattr(r.bucket, 'isoformat') else str(r.bucket),
                        r.granularity,
                        float(r.avg_value)    if r.avg_value    is not None else None,
                        float(r.min_value)    if r.min_value    is not None else None,
                        float(r.max_value)    if r.max_value    is not None else None,
                        float(r.stddev_value) if r.stddev_value is not None else None,
                        int(r.reading_count),
                        bool(r.anomaly_flag),
                        float(r.rolling_mean)   if r.rolling_mean   is not None else None,
                        float(r.rolling_stddev) if r.rolling_stddev is not None else None,
                        r.computed_at,
                    )
                    for r in rows
                ]
                psycopg2.extras.execute_values(cur, UPSERT_SQL, batch, page_size=500)
    finally:
        conn.close()


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--granularity", choices=["hourly", "daily", "both"],
        default="both",
        help="Which aggregation granularity to run (default: both)",
    )
    args, _ = parser.parse_known_args()

    spark = build_spark_session("AquaFlow-AggregateKPIs")
    spark.sparkContext.setLogLevel("WARN")

    raw_path = f"s3a://{MINIO_BUCKET}/raw/sensors/"
    print(f"\n[agg_job] Reading raw Parquet from {raw_path}")

    try:
        raw = spark.read.parquet(raw_path)
    except Exception as exc:
        print(f"[agg_job] No raw data found: {exc}")
        spark.stop()
        sys.exit(0)

    raw.cache()
    total = raw.count()
    print(f"[agg_job] Loaded {total:,} raw records")

    granularities = (
        ["hourly", "daily"] if args.granularity == "both"
        else [args.granularity]
    )

    for gran in granularities:
        print(f"\n[agg_job] Computing {gran} KPIs …")
        agg = compute_kpis(raw, gran)

        # Write to MinIO
        out_path = f"s3a://{MINIO_BUCKET}/processed/{gran}/"
        (
            agg.write
            .mode("overwrite")
            .partitionBy("station_id")
            .parquet(out_path)
        )
        print(f"[agg_job] Written Parquet to {out_path}")

        # Write to TimescaleDB
        print(f"[agg_job] Upserting {gran} rows to sensor_aggregates …")
        agg.foreachPartition(upsert_to_postgres)
        print(f"[agg_job] {gran} upsert complete")

    raw.unpersist()
    spark.stop()
    print("\n[agg_job] Done.")


if __name__ == "__main__":
    main()
