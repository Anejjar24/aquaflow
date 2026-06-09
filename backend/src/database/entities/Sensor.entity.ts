import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Alert } from './Alert.entity';
import { SensorData } from './SensorData.entity';
import { Station } from './Station.entity';

export enum SensorType {
  PRESSURE = 'pressure',
  FLOW = 'flow',
  TEMPERATURE = 'temperature',
  QUALITY = 'quality',
  LEVEL = 'level',
  PH = 'ph',
  TURBIDITY = 'turbidity',
  CHLORINE = 'chlorine',
}

export enum SensorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  FAULTY = 'faulty',
  OFFLINE = 'offline',
}

@Entity('sensors')
export class Sensor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: SensorType,
  })
  type: SensorType;

  @Column({ type: 'varchar', length: 50 })
  unit: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  minThreshold: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  maxThreshold: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  lastReading: number;

  @Column({ type: 'timestamp', nullable: true })
  lastReadingAt: Date;

  @Column({
    type: 'enum',
    enum: SensorStatus,
    default: SensorStatus.INACTIVE,
  })
  status: SensorStatus;

  @Column({ type: 'boolean', default: false })
  alertEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Station, (station) => station.sensors)
  @JoinColumn({ name: 'station_id' })
  station: Station;

  @OneToMany(() => SensorData, (data) => data.sensor)
  sensorData: SensorData[];

  @OneToMany(() => Alert, (alert) => alert.sensor)
  alerts: Alert[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  deviceId: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serialNumber: string;

  get isHealthy(): boolean {
    return this.status === SensorStatus.ACTIVE && this.lastReading !== null;
  }

  get isThresholdViolated(): boolean {
    if (!this.lastReading) return false;
    if (this.minThreshold && this.lastReading < this.minThreshold) return true;
    if (this.maxThreshold && this.lastReading > this.maxThreshold) return true;
    return false;
  }
}
