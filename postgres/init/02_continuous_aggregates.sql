-- Continuous Aggregates for sensor_data
-- These are TimescaleDB materialized views that auto-refresh as new data arrives.
-- They are created AFTER the hypertable exists (DatabaseService.onModuleInit
-- converts sensor_data to a hypertable on first boot).
--
-- This script runs only once at container creation time.
-- If the hypertable does not exist yet, these statements are silently skipped
-- via the DO block below.

DO $$
BEGIN
  -- Only create aggregates when the hypertable is already set up
  IF EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables
     WHERE hypertable_schema = 'public'
       AND hypertable_name   = 'sensor_data'
  ) THEN

    -- Hourly rollup: avg/min/max/count per sensor per hour
    CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_data_hourly
    WITH (timescaledb.continuous) AS
    SELECT
        sensor_id,
        time_bucket('1 hour', timestamp)  AS bucket,
        AVG(value)                        AS avg_value,
        MIN(value)                        AS min_value,
        MAX(value)                        AS max_value,
        COUNT(*)                          AS reading_count,
        STDDEV(value)                     AS stddev_value
    FROM sensor_data
    GROUP BY sensor_id, bucket
    WITH NO DATA;

    -- Auto-refresh: keep up to date with a 1-hour lag
    PERFORM add_continuous_aggregate_policy(
      'sensor_data_hourly',
      start_offset => INTERVAL '3 hours',
      end_offset   => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => true
    );

    -- Daily rollup: avg/min/max/count per sensor per day
    CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_data_daily
    WITH (timescaledb.continuous) AS
    SELECT
        sensor_id,
        time_bucket('1 day', timestamp)   AS bucket,
        AVG(value)                        AS avg_value,
        MIN(value)                        AS min_value,
        MAX(value)                        AS max_value,
        COUNT(*)                          AS reading_count,
        STDDEV(value)                     AS stddev_value
    FROM sensor_data
    GROUP BY sensor_id, bucket
    WITH NO DATA;

    PERFORM add_continuous_aggregate_policy(
      'sensor_data_daily',
      start_offset => INTERVAL '3 days',
      end_offset   => INTERVAL '1 day',
      schedule_interval => INTERVAL '1 day',
      if_not_exists => true
    );

    RAISE NOTICE 'TimescaleDB continuous aggregates created successfully';

  ELSE
    RAISE NOTICE 'sensor_data hypertable not found — continuous aggregates skipped. They will be created by DatabaseService on first boot.';
  END IF;
END;
$$;
