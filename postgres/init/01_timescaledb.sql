-- Enable TimescaleDB extension
-- This script runs once when the container is first created.
-- TimescaleDB must be enabled before any hypertable can be created (Task 5).
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
