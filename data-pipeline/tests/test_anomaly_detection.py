"""
Unit tests for the z-score anomaly detection logic in streaming_anomaly_detector.py.

The Spark Structured Streaming query itself requires a running Kafka broker and
cluster, so it is NOT tested here.  Instead we test the core mathematical and
configuration logic in isolation, plus verify the schema and field definitions
that the streaming job relies on.
"""

import sys
import os
import math
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "spark_jobs"))

# ── Pure-Python helpers mirroring the Spark logic ─────────────────────────────
# We extract the core z-score math so it can be tested without Spark.

def compute_z_score(value: float, rolling_mean: float, rolling_stddev: float) -> float:
    """Mirror of the Spark z-score expression in streaming_anomaly_detector.py."""
    if rolling_stddev is None or rolling_stddev <= 0:
        return 0.0
    return (value - rolling_mean) / rolling_stddev


def is_anomaly(z_score: float, threshold: float) -> bool:
    """Mirror of the Spark is_anomaly filter."""
    return abs(z_score) >= threshold


class TestZScoreComputation(unittest.TestCase):

    def test_zero_when_stddev_is_zero(self):
        self.assertEqual(compute_z_score(10.0, 10.0, 0.0), 0.0)

    def test_zero_when_stddev_is_none(self):
        self.assertEqual(compute_z_score(10.0, 10.0, None), 0.0)  # type: ignore[arg-type]

    def test_positive_z_score_for_high_value(self):
        z = compute_z_score(15.0, 10.0, 5.0)
        self.assertAlmostEqual(z, 1.0)

    def test_negative_z_score_for_low_value(self):
        z = compute_z_score(5.0, 10.0, 5.0)
        self.assertAlmostEqual(z, -1.0)

    def test_large_positive_z_score(self):
        z = compute_z_score(35.0, 10.0, 5.0)
        self.assertAlmostEqual(z, 5.0)

    def test_value_equal_to_mean_gives_zero(self):
        z = compute_z_score(10.0, 10.0, 3.0)
        self.assertAlmostEqual(z, 0.0)

    def test_z_score_formula_precision(self):
        z = compute_z_score(13.0, 10.0, 2.0)
        self.assertAlmostEqual(z, 1.5, places=6)


class TestAnomalyFlagLogic(unittest.TestCase):

    DEFAULT_THRESHOLD = 2.5

    def test_not_anomaly_below_threshold(self):
        self.assertFalse(is_anomaly(2.4, self.DEFAULT_THRESHOLD))

    def test_anomaly_at_threshold(self):
        self.assertTrue(is_anomaly(2.5, self.DEFAULT_THRESHOLD))

    def test_anomaly_above_threshold(self):
        self.assertTrue(is_anomaly(3.0, self.DEFAULT_THRESHOLD))

    def test_anomaly_with_negative_z_score(self):
        # Negative z-score (value far below mean) also triggers anomaly
        self.assertTrue(is_anomaly(-3.0, self.DEFAULT_THRESHOLD))

    def test_not_anomaly_negative_within_threshold(self):
        self.assertFalse(is_anomaly(-2.4, self.DEFAULT_THRESHOLD))

    def test_zero_z_score_not_anomaly(self):
        self.assertFalse(is_anomaly(0.0, self.DEFAULT_THRESHOLD))


class TestSeverityMapping(unittest.TestCase):
    """
    Mirror the severity mapping from KafkaConsumerService.onSensorAnomaly().
    Kept here so the logic is validated by Python tests independent of NestJS.
    """

    def _severity(self, z_score: float) -> str:
        if z_score >= 4:
            return "CRITICAL"
        elif z_score >= 3:
            return "ERROR"
        else:
            return "WARNING"

    def test_warning_for_z_score_below_3(self):
        self.assertEqual(self._severity(2.5), "WARNING")

    def test_warning_for_z_score_just_under_3(self):
        self.assertEqual(self._severity(2.99), "WARNING")

    def test_error_for_z_score_3(self):
        self.assertEqual(self._severity(3.0), "ERROR")

    def test_error_for_z_score_between_3_and_4(self):
        self.assertEqual(self._severity(3.7), "ERROR")

    def test_critical_for_z_score_4(self):
        self.assertEqual(self._severity(4.0), "CRITICAL")

    def test_critical_for_z_score_above_4(self):
        self.assertEqual(self._severity(10.0), "CRITICAL")


class TestStreamingAnomalyDetectorConfig(unittest.TestCase):
    """Verify that the streaming job loads configuration from environment."""

    def test_default_z_score_threshold_is_2_5(self):
        import streaming_anomaly_detector as sad
        # Default value (no env override in test)
        self.assertEqual(sad.Z_SCORE_THRESHOLD, 2.5)

    def test_default_window_duration(self):
        import streaming_anomaly_detector as sad
        self.assertEqual(sad.WINDOW_DURATION, "5 minutes")

    def test_default_slide_duration(self):
        import streaming_anomaly_detector as sad
        self.assertEqual(sad.SLIDE_DURATION, "1 minute")

    def test_default_input_topic(self):
        import streaming_anomaly_detector as sad
        self.assertEqual(sad.INPUT_TOPIC, "sensors.readings")

    def test_default_output_topic(self):
        import streaming_anomaly_detector as sad
        self.assertEqual(sad.OUTPUT_TOPIC, "sensors.anomalies")

    def test_z_score_threshold_from_env(self):
        with unittest.mock.patch.dict(os.environ, {"Z_SCORE_THRESHOLD": "3.0"}):
            import importlib
            import streaming_anomaly_detector as sad
            importlib.reload(sad)
            self.assertEqual(sad.Z_SCORE_THRESHOLD, 3.0)
            # Restore
            importlib.reload(sad)


class TestReadingSchema(unittest.TestCase):
    """Verify the Spark schema has required fields."""

    def test_schema_has_sensor_id_field(self):
        import streaming_anomaly_detector as sad
        field_names = [f.name for f in sad.READING_SCHEMA.fields]
        self.assertIn("sensorId", field_names)

    def test_schema_has_value_field(self):
        import streaming_anomaly_detector as sad
        field_names = [f.name for f in sad.READING_SCHEMA.fields]
        self.assertIn("value", field_names)

    def test_schema_has_timestamp_field(self):
        import streaming_anomaly_detector as sad
        field_names = [f.name for f in sad.READING_SCHEMA.fields]
        self.assertIn("timestamp", field_names)

    def test_schema_has_station_id_field(self):
        import streaming_anomaly_detector as sad
        field_names = [f.name for f in sad.READING_SCHEMA.fields]
        self.assertIn("stationId", field_names)


import unittest.mock  # needed for TestStreamingAnomalyDetectorConfig

if __name__ == "__main__":
    unittest.main()
