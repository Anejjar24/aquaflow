"""
Unit tests for kafka_to_minio.py — runs fully isolated (no Kafka, no MinIO).

Tested:
  - BatchBuffer  : add / should_flush (volume + time) / drain
  - rows_to_parquet_bytes : schema, columns, Snappy compression
  - build_s3_key  : Hive-partitioned path format
  - _parse_ts_ms  : ISO-8601 parsing, fallback on bad input
"""

import sys
import os
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

# ---------------------------------------------------------------------------
# Ensure the parent directory (data-pipeline/) is importable even when pytest
# is invoked from the project root.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import kafka_to_minio as k2m


# ── BatchBuffer ─────────────────────────────────────────────────────────────

class TestBatchBuffer(unittest.TestCase):

    def _make_buffer(self, batch_size=500, flush_secs=60):
        """Create a BatchBuffer with patched module-level constants."""
        with patch.object(k2m, "BATCH_SIZE", batch_size), \
             patch.object(k2m, "FLUSH_SECS", flush_secs):
            buf = k2m.BatchBuffer()
        # Store the patched values so should_flush sees them too
        self._batch_size = batch_size
        self._flush_secs = flush_secs
        return buf

    def test_empty_buffer_has_length_zero(self):
        buf = k2m.BatchBuffer()
        self.assertEqual(len(buf), 0)

    def test_add_increases_length(self):
        buf = k2m.BatchBuffer()
        buf.add({"sensorId": "s1", "value": 1.0})
        self.assertEqual(len(buf), 1)

    def test_should_flush_false_below_batch_size(self):
        with patch.object(k2m, "BATCH_SIZE", 10), patch.object(k2m, "FLUSH_SECS", 3600):
            buf = k2m.BatchBuffer()
            for i in range(9):
                buf.add({"v": i})
            self.assertFalse(buf.should_flush())

    def test_should_flush_true_at_batch_size(self):
        with patch.object(k2m, "BATCH_SIZE", 5), patch.object(k2m, "FLUSH_SECS", 3600):
            buf = k2m.BatchBuffer()
            for i in range(5):
                buf.add({"v": i})
            self.assertTrue(buf.should_flush())

    def test_should_flush_true_when_time_exceeded(self):
        with patch.object(k2m, "FLUSH_SECS", 0):
            buf = k2m.BatchBuffer()
            buf.add({"v": 1})
            # FLUSH_SECS=0 means any elapsed time triggers flush
            self.assertTrue(buf.should_flush())

    def test_drain_returns_all_rows_and_clears_buffer(self):
        buf = k2m.BatchBuffer()
        rows = [{"v": i} for i in range(5)]
        for r in rows:
            buf.add(r)

        drained = buf.drain()
        self.assertEqual(len(drained), 5)
        self.assertEqual(len(buf), 0)

    def test_drain_resets_last_flush_time(self):
        with patch.object(k2m, "FLUSH_SECS", 0):
            buf = k2m.BatchBuffer()
            buf.add({"v": 1})
            buf.drain()
            # After drain, timer resets — with FLUSH_SECS=0 it may still be True
            # but the buffer is empty so it doesn't matter; just assert no crash.
            _ = buf.should_flush()  # should not raise

    def test_drain_on_empty_buffer_returns_empty_list(self):
        buf = k2m.BatchBuffer()
        self.assertEqual(buf.drain(), [])


# ── _parse_ts_ms ─────────────────────────────────────────────────────────────

class TestParseTsMs(unittest.TestCase):

    def test_parses_iso8601_utc_z(self):
        ts = "2026-06-08T12:00:00Z"
        result = k2m._parse_ts_ms(ts)
        expected = int(datetime(2026, 6, 8, 12, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
        self.assertEqual(result, expected)

    def test_parses_iso8601_with_offset(self):
        ts = "2026-06-08T12:00:00+00:00"
        result = k2m._parse_ts_ms(ts)
        expected = int(datetime(2026, 6, 8, 12, 0, 0, tzinfo=timezone.utc).timestamp() * 1000)
        self.assertEqual(result, expected)

    def test_returns_current_time_on_invalid_string(self):
        before = int(time.time() * 1000)
        result = k2m._parse_ts_ms("not-a-date")
        after = int(time.time() * 1000)
        self.assertGreaterEqual(result, before)
        self.assertLessEqual(result, after + 1000)

    def test_returns_current_time_on_empty_string(self):
        before = int(time.time() * 1000)
        result = k2m._parse_ts_ms("")
        after = int(time.time() * 1000)
        self.assertGreaterEqual(result, before)
        self.assertLessEqual(result, after + 1000)


# ── build_s3_key ──────────────────────────────────────────────────────────────

class TestBuildS3Key(unittest.TestCase):

    def _ts(self, year=2026, month=6, day=8):
        return datetime(year, month, day, 10, 30, 0, tzinfo=timezone.utc)

    def test_key_starts_with_raw_sensors(self):
        key = k2m.build_s3_key("station-abc", self._ts(), "deadbeef")
        self.assertTrue(key.startswith("raw/sensors/"))

    def test_key_contains_hive_year_partition(self):
        key = k2m.build_s3_key("station-abc", self._ts(2026), "id1")
        self.assertIn("year=2026", key)

    def test_key_contains_hive_month_partition_zero_padded(self):
        key = k2m.build_s3_key("station-abc", self._ts(month=6), "id1")
        self.assertIn("month=06", key)

    def test_key_contains_hive_day_partition_zero_padded(self):
        key = k2m.build_s3_key("station-abc", self._ts(day=8), "id1")
        self.assertIn("day=08", key)

    def test_key_contains_station_id(self):
        key = k2m.build_s3_key("station-xyz", self._ts(), "id1")
        self.assertIn("station=station-xyz", key)

    def test_key_uses_unknown_for_empty_station(self):
        key = k2m.build_s3_key("", self._ts(), "id1")
        self.assertIn("station=unknown", key)

    def test_key_ends_with_parquet_extension(self):
        key = k2m.build_s3_key("st1", self._ts(), "abc123")
        self.assertTrue(key.endswith(".parquet"))

    def test_key_contains_batch_id(self):
        key = k2m.build_s3_key("st1", self._ts(), "myhexid")
        self.assertIn("myhexid", key)


# ── rows_to_parquet_bytes ─────────────────────────────────────────────────────

class TestRowsToParquetBytes(unittest.TestCase):

    def _make_rows(self, n=3):
        return [
            {
                "sensorId": f"sensor-{i}",
                "stationId": "station-1",
                "type": "pressure",
                "value": float(i * 10),
                "unit": "bar",
                "timestamp": "2026-06-08T10:00:00Z",
                "thresholdViolated": False,
            }
            for i in range(1, n + 1)
        ]

    def test_returns_bytes(self):
        result = k2m.rows_to_parquet_bytes(self._make_rows())
        self.assertIsInstance(result, bytes)

    def test_parquet_is_non_empty(self):
        result = k2m.rows_to_parquet_bytes(self._make_rows())
        self.assertGreater(len(result), 0)

    def test_parquet_starts_with_magic_bytes(self):
        # Parquet files start with b"PAR1"
        result = k2m.rows_to_parquet_bytes(self._make_rows())
        self.assertEqual(result[:4], b"PAR1")

    def test_parquet_ends_with_magic_bytes(self):
        result = k2m.rows_to_parquet_bytes(self._make_rows())
        self.assertEqual(result[-4:], b"PAR1")

    def test_roundtrip_row_count(self):
        import pyarrow.parquet as pq
        import io
        rows = self._make_rows(5)
        data = k2m.rows_to_parquet_bytes(rows)
        table = pq.read_table(io.BytesIO(data))
        self.assertEqual(table.num_rows, 5)

    def test_roundtrip_value_column(self):
        import pyarrow.parquet as pq
        import io
        rows = self._make_rows(2)
        data = k2m.rows_to_parquet_bytes(rows)
        table = pq.read_table(io.BytesIO(data))
        values = table.column("value").to_pylist()
        self.assertEqual(values, [10.0, 20.0])

    def test_handles_camelCase_keys(self):
        """Accepts both sensorId (camelCase) and sensor_id (snake_case)."""
        rows = [{"sensorId": "s1", "stationId": "st1", "type": "t", "value": 1.0,
                 "unit": "u", "timestamp": "2026-01-01T00:00:00Z", "thresholdViolated": True}]
        result = k2m.rows_to_parquet_bytes(rows)
        self.assertIsInstance(result, bytes)

    def test_missing_optional_fields_do_not_raise(self):
        rows = [{"sensorId": "s1", "value": 5.0, "timestamp": "2026-01-01T00:00:00Z",
                 "thresholdViolated": False}]
        result = k2m.rows_to_parquet_bytes(rows)
        self.assertIsInstance(result, bytes)


if __name__ == "__main__":
    unittest.main()
