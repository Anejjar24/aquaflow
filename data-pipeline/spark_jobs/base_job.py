"""
base_job.py — PySpark S3A/MinIO connectivity smoke-test.

Reads a sample Parquet from aquaflow-lake/raw/sensors/, prints schema + row count.
Run from spark-master:
  spark-submit --master spark://spark-master:7077 /opt/spark-jobs/base_job.py
"""

import os
from pyspark.sql import SparkSession


def build_spark_session(app_name: str) -> SparkSession:
    minio_endpoint = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
    minio_access   = os.getenv("MINIO_ACCESS_KEY", "aquaflow")
    minio_secret   = os.getenv("MINIO_SECRET_KEY", "aquaflow123")

    return (
        SparkSession.builder
        .appName(app_name)
        .config("spark.hadoop.fs.s3a.endpoint",          minio_endpoint)
        .config("spark.hadoop.fs.s3a.access.key",        minio_access)
        .config("spark.hadoop.fs.s3a.secret.key",        minio_secret)
        .config("spark.hadoop.fs.s3a.path.style.access", "true")
        .config("spark.hadoop.fs.s3a.impl",
                "org.apache.hadoop.fs.s3a.S3AFileSystem")
        .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "false")
        # Avoid metadata service calls on non-AWS deployments
        .config("spark.hadoop.fs.s3a.aws.credentials.provider",
                "org.apache.hadoop.fs.s3a.SimpleAWSCredentialsProvider")
        .getOrCreate()
    )


def main():
    spark = build_spark_session("AquaFlow-BaseJob-Connectivity")
    spark.sparkContext.setLogLevel("WARN")

    bucket = os.getenv("MINIO_BUCKET", "aquaflow-lake")
    path   = f"s3a://{bucket}/raw/sensors/"

    print(f"\n[base_job] Reading Parquet from: {path}")
    try:
        df = spark.read.parquet(path)
        print("\n[base_job] Schema:")
        df.printSchema()
        count = df.count()
        print(f"\n[base_job] Row count: {count:,}")
        print("\n[base_job] Sample (5 rows):")
        df.show(5, truncate=False)
    except Exception as exc:
        print(f"\n[base_job] No data found yet (bucket may be empty): {exc}")
        print("[base_job] Connectivity to MinIO confirmed if no S3A auth error above.")

    spark.stop()
    print("\n[base_job] Done.")


if __name__ == "__main__":
    main()
