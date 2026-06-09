import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './User.entity';
import { Station } from './Station.entity';

export enum MaintenanceType {
  PREVENTIVE = 'preventive',
  CORRECTIVE = 'corrective',
  INSPECTION = 'inspection',
  REPAIR = 'repair',
  REPLACEMENT = 'replacement',
  CALIBRATION = 'calibration',
}

export enum MaintenanceStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum MaintenancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('maintenances')
export class Maintenance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({
    type: 'enum',
    enum: MaintenanceType,
  })
  type: MaintenanceType;

  @Column({
    type: 'enum',
    enum: MaintenanceStatus,
    default: MaintenanceStatus.SCHEDULED,
  })
  status: MaintenanceStatus;

  @Column({
    type: 'enum',
    enum: MaintenancePriority,
    default: MaintenancePriority.MEDIUM,
  })
  priority: MaintenancePriority;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  workDone: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Station, (station) => station.maintenances, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'station_id' })
  station: Station;

  @Column({ type: 'varchar', length: 255, nullable: true })
  equipment: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  partNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualCost: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  estimatedDuration: number; // in hours

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  actualDuration: number; // in hours

  @ManyToOne(() => User, (user) => user.createdMaintenances, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, (user) => user.assignedMaintenances, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assigned_to' })
  assignedTo: User;

  @Column({ type: 'timestamp', nullable: true })
  scheduledDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'simple-array', nullable: true })
  attachmentUrls: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  get isOverdue(): boolean {
    if (this.scheduledDate && this.status !== MaintenanceStatus.COMPLETED) {
      return new Date() > this.scheduledDate;
    }
    return false;
  }

  get duration(): number | null {
    if (this.startedAt && this.completedAt) {
      return this.completedAt.getTime() - this.startedAt.getTime();
    }
    return null;
  }
}
