import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Stores pre-computed per-sensor KPIs produced by the Spark aggregation job.
 * Primary key: (sensor_id, bucket, granularity) — matches the Spark UPSERT.
 */
@Entity('sensor_aggregates')
@Index(['stationId', 'bucket'])
@Index(['sensorId', 'granularity', 'bucket'])
export class SensorAggregate {
  @PrimaryColumn({ name: 'sensor_id', type: 'uuid' })
  sensorId: string;

  @PrimaryColumn({ name: 'bucket', type: 'timestamptz' })
  bucket: Date;

  @PrimaryColumn({ name: 'granularity', type: 'varchar', length: 10 })
  granularity: string;

  @Column({ name: 'station_id', type: 'uuid' })
  stationId: string;

  @Column({ name: 'avg_value', type: 'double precision', nullable: true })
  avgValue: number | null;

  @Column({ name: 'min_value', type: 'double precision', nullable: true })
  minValue: number | null;

  @Column({ name: 'max_value', type: 'double precision', nullable: true })
  maxValue: number | null;

  @Column({ name: 'stddev_value', type: 'double precision', nullable: true })
  stddevValue: number | null;

  @Column({ name: 'reading_count', type: 'bigint', nullable: true })
  readingCount: number | null;

  @Column({ name: 'anomaly_flag', type: 'boolean', default: false })
  anomalyFlag: boolean;

  @Column({ name: 'rolling_mean', type: 'double precision', nullable: true })
  rollingMean: number | null;

  @Column({ name: 'rolling_stddev', type: 'double precision', nullable: true })
  rollingStddev: number | null;

  @Column({ name: 'computed_at', type: 'timestamptz' })
  computedAt: Date;
}
