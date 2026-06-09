# ── AquaFlow Kafka→MinIO Archival Pipeline ────────────────────────────────────
FROM python:3.12-slim

LABEL maintainer="AquaFlow Team"
LABEL description="Kafka consumer that archives sensor readings to MinIO as Parquet"

# Install system dependencies for pyarrow
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cached unless requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY kafka_to_minio.py .

# Non-root user for security
RUN addgroup --system pipeline && adduser --system --ingroup pipeline pipeline
USER pipeline

# Environment variable defaults (overridden by docker-compose)
ENV KAFKA_BROKERS=kafka:9092 \
    KAFKA_GROUP_ID=aquaflow-lake-archiver \
    KAFKA_TOPIC=sensors.readings \
    MINIO_ENDPOINT=http://minio:9000 \
    MINIO_ACCESS_KEY=aquaflow \
    MINIO_SECRET_KEY=aquaflow123 \
    MINIO_BUCKET=aquaflow-lake \
    BATCH_SIZE=500 \
    FLUSH_SECS=60 \
    LOG_LEVEL=INFO

CMD ["python", "-u", "kafka_to_minio.py"]
