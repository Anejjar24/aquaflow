import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from './User.entity';
import { Station } from './Station.entity';
import { Sensor } from './Sensor.entity';
import { Notification } from './Notification.entity';

export enum AlertType {
  THRESHOLD_VIOLATION = 'threshold_violation',
  SENSOR_OFFLINE = 'sensor_offline',
  MAINTENANCE_DUE = 'maintenance_due',
  SYSTEM_ERROR = 'system_error',
  ANOMALY = 'anomaly',
  CRITICAL_EVENT = 'critical_event',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: AlertType,
  })
  type: AlertType;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
  })
  severity: AlertSeverity;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.ACTIVE,
  })
  status: AlertStatus;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any>;

  @ManyToOne(() => Station, (station) => station.alerts, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'station_id' })
  station: Station;

  @ManyToOne(() => Sensor, (sensor) => sensor.alerts, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'sensor_id' })
  sensor: Sensor;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledgedBy: User;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'resolved_by' })
  resolvedBy: User;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sourceSystem: string;

  @Column({ type: 'boolean', default: false })
  isNotified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Notification, (notification) => notification.alert)
  notifications: Notification[];

  get duration(): number {
    if (this.acknowledgedAt) {
      return this.acknowledgedAt.getTime() - this.createdAt.getTime();
    }
    return Date.now() - this.createdAt.getTime();
  }

  get isActive(): boolean {
    return this.status === AlertStatus.ACTIVE;
  }
}
