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
import { WorkflowExecution } from './WorkflowExecution.entity';

export enum WorkflowStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

export enum WorkflowTriggerType {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
  SENSOR_THRESHOLD = 'sensor_threshold',
  ALERT = 'alert',
  TIME_BASED = 'time_based',
  EXTERNAL = 'external',
}

@Entity('workflows')
export class Workflow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    default: WorkflowStatus.DRAFT,
  })
  status: WorkflowStatus;

  @Column({
    type: 'enum',
    enum: WorkflowTriggerType,
    default: WorkflowTriggerType.MANUAL,
  })
  triggerType: WorkflowTriggerType;

  @Column({ type: 'jsonb' })
  graph: Record<string, any>; // Serialized Joint.js graph or workflow definition

  @Column({ type: 'jsonb', nullable: true })
  triggerConfig: Record<string, any>; // Trigger-specific configuration

  @Column({ type: 'varchar', length: 100, nullable: true })
  tags: string; // Comma-separated tags

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isPublished: boolean;

  @Column({ type: 'integer', default: 0 })
  executionCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastExecutedAt: Date;

  @ManyToOne(() => User, (user) => user.createdWorkflows, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'text', nullable: true })
  errorLog: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => WorkflowExecution, (execution) => execution.workflow)
  executions: WorkflowExecution[];

  get isValid(): boolean {
    return this.graph && Object.keys(this.graph).length > 0;
  }
}
