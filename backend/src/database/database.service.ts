import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.verifyTimescaleDb();
    await this.setupHypertables();
  }

  /** Log whether TimescaleDB extension is installed — does NOT throw if missing. */
  private async verifyTimescaleDb(): Promise<void> {
    try {
      const rows = await this.dataSource.query(
        `SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'`,
      );
      if (rows.length > 0) {
        this.logger.log(`TimescaleDB extension active (v${rows[0].extversion})`);
      } else {
        this.logger.warn(
          'TimescaleDB extension NOT found. ' +
          'Ensure the postgres/init/01_timescaledb.sql init script ran ' +
          'and restart with a fresh volume if needed.',
        );
      }
    } catch {
      this.logger.warn('Could not verify TimescaleDB extension status');
    }
  }

  // ── Hypertable setup ────────────────────────────────────────────────────────

  /**
   * Convert time-series tables to TimescaleDB hypertables.
   * Runs after TypeORM schema sync so the tables exist before we touch them.
   * Idempotent — safe to call on every restart.
   */
  private async setupHypertables(): Promise<void> {
    const tsVersion = await this.getTimescaleVersion();
    if (!tsVersion) {
      this.logger.warn('Skipping hypertable setup — TimescaleDB not available');
      return;
    }

    await this.convertSensorDataToHypertable();
  }

  private async convertSensorDataToHypertable(): Promise<void> {
    try {
      // ── 1. Already a hypertable? ─────────────────────────────────────────
      const existing = await this.dataSource.query(
        `SELECT hypertable_name
           FROM timescaledb_information.hypertables
          WHERE hypertable_schema = 'public'
            AND hypertable_name   = 'sensor_data'`,
      );

      if (existing.length > 0) {
        this.logger.log('sensor_data: already a TimescaleDB hypertable — skipping');
        return;
      }

      // ── 2. Convert to hypertable (7-day chunks, preserving any existing data) ─
      await this.dataSource.query(
        `SELECT create_hypertable(
            'sensor_data',
            'timestamp',
            chunk_time_interval => INTERVAL '7 days',
            migrate_data        => true,
            if_not_exists       => true
         )`,
      );
      this.logger.log('sensor_data: hypertable created (7-day chunks)');

      // ── 3. Retention policy — drop chunks older than 90 days ────────────
      await this.dataSource.query(
        `SELECT add_retention_policy(
            'sensor_data',
            INTERVAL '90 days',
            if_not_exists => true
         )`,
      );
      this.logger.log('sensor_data: retention policy set (90 days)');

      // ── 4. Compression — compress chunks older than 14 days ─────────────
      await this.dataSource.query(
        `ALTER TABLE sensor_data
            SET (
              timescaledb.compress,
              timescaledb.compress_orderby   = 'timestamp DESC',
              timescaledb.compress_segmentby = 'sensor_id'
            )`,
      );
      await this.dataSource.query(
        `SELECT add_compression_policy(
            'sensor_data',
            INTERVAL '14 days',
            if_not_exists => true
         )`,
      );
      this.logger.log('sensor_data: compression policy set (compress after 14 days)');

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Hypertable setup for sensor_data failed: ${msg}`);
      // Non-fatal — the app still works, just without TS optimisations
    }
  }

  /** Returns hypertable statistics for the /api/analytics/pipeline/stats endpoint. */
  async getHypertableInfo(): Promise<Record<string, any> | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT
            h.hypertable_name,
            h.num_dimensions,
            h.num_chunks,
            h.compression_enabled,
            ts.total_bytes,
            ts.compressed_bytes,
            ROUND(
              CASE WHEN ts.total_bytes > 0
                   THEN (1 - ts.compressed_bytes::numeric / ts.total_bytes) * 100
                   ELSE 0
              END, 2
            ) AS compression_ratio_pct
           FROM timescaledb_information.hypertables h
           LEFT JOIN (
             SELECT hypertable_name,
                    SUM(before_compression_total_bytes)      AS total_bytes,
                    SUM(after_compression_total_bytes)       AS compressed_bytes
               FROM timescaledb_information.chunk_compression_stats
              GROUP BY hypertable_name
           ) ts ON ts.hypertable_name = h.hypertable_name
          WHERE h.hypertable_schema = 'public'
            AND h.hypertable_name   = 'sensor_data'`,
      );
      return rows[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Check if the database connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT NOW()');
      this.logger.debug('Database health check passed');
      return true;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  /** Returns TimescaleDB version, or null if not installed. */
  async getTimescaleVersion(): Promise<string | null> {
    try {
      const rows = await this.dataSource.query(
        `SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'`,
      );
      return rows.length > 0 ? (rows[0].extversion as string) : null;
    } catch {
      return null;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<Record<string, any>> {
    try {
      const tables = await this.dataSource.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `);

      const stats: Record<string, any> = {
        tables: [],
        totalRows: 0,
      };

      for (const table of tables) {
        const countResult = await this.dataSource.query(
          `SELECT COUNT(*) as count FROM "${table.table_name}"`,
        );
        const count = parseInt(countResult[0].count, 10);
        stats.tables.push({
          name: table.table_name,
          rows: count,
        });
        stats.totalRows += count;
      }

      return stats;
    } catch (error) {
      this.logger.error('Failed to get database stats', error);
      throw error;
    }
  }

  /**
   * Run raw query
   */
  async query(sql: string, parameters?: any[]): Promise<any[]> {
    try {
      return await this.dataSource.query(sql, parameters);
    } catch (error) {
      this.logger.error(`Query failed: ${sql}`, error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.dataSource.isInitialized;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
      this.logger.log('Database connection closed');
    }
  }
}
