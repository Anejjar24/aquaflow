import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Sensor } from './Sensor.entity';

/**
 * SensorData — time-series readings from physical sensors.
 *
 * Schema note:
 *   The primary key is composite (id, timestamp) so that TimescaleDB can
 *   partition by `timestamp` while each row still has a globally unique `id`.
 *   TimescaleDB requires that every UNIQUE/PRIMARY KEY constraint includes
 *   the partitioning column.
 *
 *   The hypertable itself is created by DatabaseService.onModuleInit()
 *   after TypeORM has synchronised the schema (see database.service.ts).
 */
@Entity('sensor_data')
@Index(['sensor', 'timestamp'])
export class SensorData {
  /** UUID, auto-generated via @BeforeInsert hook (Node.js crypto.randomUUID). */
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'decimal', precision: 15, scale: 4 })
  value: number;

  /** Partitioning column — must be part of the primary key for TimescaleDB. */
  @PrimaryColumn({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'jsonb', nullable: true })
  qualityFlags: Record<string, any>;

  @ManyToOne(() => Sensor, (sensor) => sensor.sensorData, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  source: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  accuracy: number;

  @BeforeInsert()
  setDefaults(): void {
    if (!this.id) {
      // crypto.randomUUID() is available in Node.js ≥ 14.17 — no extra package needed
      this.id = (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : require('crypto').randomUUID();
    }
    if (!this.timestamp) {
      this.timestamp = new Date();
    }
  }
}
