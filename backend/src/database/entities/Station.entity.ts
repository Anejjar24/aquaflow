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
import { Maintenance } from './Maintenance.entity';
import { Sensor } from './Sensor.entity';
import { User } from './User.entity';

export enum StationStatus {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
  OFFLINE = 'offline',
}

export enum StationType {
  TREATMENT = 'treatment',
  DISTRIBUTION = 'distribution',
  STORAGE = 'storage',
  MONITORING = 'monitoring',
}

@Entity('stations')
export class Station {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  location: string;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  longitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  capacity: number;

  @Column({ type: 'varchar', length: 50, default: 'liters' })
  capacityUnit: string;

  @Column({
    type: 'enum',
    enum: StationType,
    default: StationType.TREATMENT,
  })
  type: StationType;

  @Column({
    type: 'enum',
    enum: StationStatus,
    default: StationStatus.OFFLINE,
  })
  status: StationStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'simple-array', nullable: true })
  equipments: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @OneToMany(() => Sensor, (sensor) => sensor.station)
  sensors: Sensor[];

  @OneToMany(() => Alert, (alert) => alert.station)
  alerts: Alert[];

  @OneToMany(() => Maintenance, (maintenance) => maintenance.station)
  maintenances: Maintenance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastStatusChange: Date;

  get statusColor(): string {
    const colors = {
      [StationStatus.NORMAL]: '#10b981',
      [StationStatus.WARNING]: '#f59e0b',
      [StationStatus.CRITICAL]: '#ef4444',
      [StationStatus.OFFLINE]: '#6b7280',
    };
    return colors[this.status];
  }
}
