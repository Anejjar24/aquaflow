"""
streaming_anomaly_detector.py — PySpark Structured Streaming anomaly detection.

Reads from Kafka topic sensors.readings (JSON), applies a 5-minute sliding
window (1-minute slide) per sensor to compute rolling mean + stddev + z-score.
Flags anomalies when abs(z-score) >= 2.5 and writes them to Kafka topic
sensors.anomalies (JSON).

The NestJS KafkaConsumerService (Task 3) subscribes to sensors.anomalies and
creates Alert records automatically.

Run:
  spark-submit --master spark://spark-master:7077 \
    --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0 \
    /opt/spark-jobs/streaming_anomaly_detector.py
"""

import os
import json

from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import (
    DoubleType, StringType, StructField, StructType, TimestampType,
)


# ─── Config ──────────────────────────────────────────────────────────────────

KAFKA_BROKERS      = os.getenv("KAFKA_BROKERS",       "kafka:9092")
INPUT_TOPIC        = os.getenv("KAFKA_INPUT_TOPIC",   "sensors.readings")
OUTPUT_TOPIC       = os.getenv("KAFKA_OUTPUT_TOPIC",  "sensors.anomalies")
CHECKPOINT_DIR     = os.getenv("CHECKPOINT_DIR",      "/tmp/spark-checkpoints/anomaly-detector")
Z_SCORE_THRESHOLD  = float(os.getenv("Z_SCORE_THRESHOLD", "2.5"))
WINDOW_DURATION    = os.getenv("WINDOW_DURATION",     "5 minutes")
SLIDE_DURATION     = os.getenv("SLIDE_DURATION",      "1 minute")
WATERMARK_DELAY    = os.getenv("WATERMARK_DELAY",     "2 minutes")


# ─── Schema for incoming sensor readings ─────────────────────────────────────

READING_SCHEMA = StructType([
    StructField("sensorId",  StringType(),    True),
    StructField("stationId", StringType(),    True),
    StructField("type",      StringType(),    True),
    StructField("value",     DoubleType(),    True),
    StructField("unit",      StringType(),    True),
    StructField("timestamp", StringType(),    True),  # ISO 8601 string
])


# ─── SparkSession ────────────────────────────────────────────────────────────

def build_spark_session() -> SparkSession:
    return (
        SparkSession.builder
        .appName("AquaFlow-StreamingAnomalyDetector")
        # Reduce shuffle for dev
        .config("spark.sql.shuffle.partitions", "8")
        # Structured Streaming Kafka integration
        .config("spark.jars.packages",
                "org.apache.spark:spark-sql-kafka-0-10_2.12:3.5.0")
        .getOrCreate()
    )


# ─── Anomaly detection logic ─────────────────────────────────────────────────

def build_anomaly_stream(spark: SparkSession):
    # 1. Read raw Kafka messages
    raw = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BROKERS)
        .option("subscribe", INPUT_TOPIC)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    # 2. Parse JSON payload
    parsed = (
        raw
        .select(F.from_json(F.col("value").cast("string"), READING_SCHEMA).alias("d"))
        .select("d.*")
        .withColumn("event_time", F.to_timestamp("timestamp"))
        .filter(F.col("event_time").isNotNull() & F.col("value").isNotNull())
    )

    # 3. Apply watermark + 5-min sliding window per sensor
    windowed = (
        parsed
        .withWatermark("event_time", WATERMARK_DELAY)
        .groupBy(
            F.col("sensorId"),
            F.col("stationId"),
            F.col("type"),
            F.col("unit"),
            F.window("event_time", WINDOW_DURATION, SLIDE_DURATION),
        )
        .agg(
            F.avg("value").alias("rolling_mean"),
            F.stddev("value").alias("rolling_stddev"),
            F.last("value").alias("last_value"),
            F.last("timestamp").alias("last_timestamp"),
            F.count("*").alias("window_count"),
        )
    )

    # 4. Compute z-score and flag anomalies
    with_zscore = (
        windowed
        .withColumn(
            "z_score",
            F.when(
                (F.col("rolling_stddev").isNotNull()) & (F.col("rolling_stddev") > 0),
                (F.col("last_value") - F.col("rolling_mean")) / F.col("rolling_stddev"),
            ).otherwise(F.lit(0.0)),
        )
        .withColumn(
            "is_anomaly",
            F.abs(F.col("z_score")) >= Z_SCORE_THRESHOLD,
        )
        .filter(F.col("is_anomaly"))
        # Need at least a few readings for a meaningful z-score
        .filter(F.col("window_count") >= 3)
    )

    # 5. Build output JSON payload for sensors.anomalies topic
    anomaly_payload = (
        with_zscore
        .select(
            F.to_json(
                F.struct(
                    F.col("sensorId"),
                    F.col("stationId"),
                    F.col("type"),
                    F.col("last_value").alias("value"),
                    F.col("unit"),
                    F.col("last_timestamp").alias("timestamp"),
                    F.round(F.col("z_score"), 4).alias("zScore"),
                    F.round(F.col("rolling_mean"), 4).alias("rollingMean"),
                    F.round(F.col("rolling_stddev"), 4).alias("rollingStddev"),
                    F.lit(5).alias("windowMinutes"),
                    F.col("window.start").cast("string").alias("windowStart"),
                    F.col("window.end").cast("string").alias("windowEnd"),
                )
            ).alias("value"),
            F.col("sensorId").alias("key"),
        )
    )

    return anomaly_payload


# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    spark = build_spark_session()
    spark.sparkContext.setLogLevel("WARN")

    print(f"\n[anomaly] Starting streaming detector")
    print(f"[anomaly] Input:  {KAFKA_BROKERS} -> {INPUT_TOPIC}")
    print(f"[anomaly] Output: {KAFKA_BROKERS} -> {OUTPUT_TOPIC}")
    print(f"[anomaly] Window: {WINDOW_DURATION} (slide {SLIDE_DURATION})")
    print(f"[anomaly] Z-score threshold: {Z_SCORE_THRESHOLD}\n")

    anomaly_stream = build_anomaly_stream(spark)

    query = (
        anomaly_stream
        .writeStream
        .format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BROKERS)
        .option("topic", OUTPUT_TOPIC)
        .option("checkpointLocation", CHECKPOINT_DIR)
        .outputMode("append")
        .start()
    )

    print("[anomaly] Streaming query started — awaiting termination …")
    query.awaitTermination()


if __name__ == "__main__":
    main()
