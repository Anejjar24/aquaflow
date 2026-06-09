-- Pre-computed KPI table populated by the Spark aggregation job.
-- TypeORM also creates this via synchronize, but having it here ensures
-- it exists before the first Spark run (even if backend hasn't started yet).

CREATE TABLE IF NOT EXISTS sensor_aggregates (
    sensor_id      UUID            NOT NULL,
    station_id     UUID            NOT NULL,
    bucket         TIMESTAMPTZ     NOT NULL,
    granularity    VARCHAR(10)     NOT NULL,
    avg_value      DOUBLE PRECISION,
    min_value      DOUBLE PRECISION,
    max_value      DOUBLE PRECISION,
    stddev_value   DOUBLE PRECISION,
    reading_count  BIGINT,
    anomaly_flag   BOOLEAN         NOT NULL DEFAULT FALSE,
    rolling_mean   DOUBLE PRECISION,
    rolling_stddev DOUBLE PRECISION,
    computed_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (sensor_id, bucket, granularity)
);

CREATE INDEX IF NOT EXISTS idx_sa_station_bucket
    ON sensor_aggregates (station_id, bucket);

CREATE INDEX IF NOT EXISTS idx_sa_sensor_gran_bucket
    ON sensor_aggregates (sensor_id, granularity, bucket);
