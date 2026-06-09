import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workflow } from './Workflow.entity';
import { User } from './User.entity';

export enum WorkflowExecutionStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused',
}

@Entity('workflow_executions')
export class WorkflowExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workflow, (workflow) => workflow.executions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @Column({
    type: 'enum',
    enum: WorkflowExecutionStatus,
    default: WorkflowExecutionStatus.RUNNING,
  })
  status: WorkflowExecutionStatus;

  @Column({ type: 'jsonb', nullable: true })
  input: Record<string, any>; // Input variables passed to the workflow

  @Column({ type: 'jsonb', nullable: true })
  output: Record<string, any>; // Output variables from the workflow

  @Column({ type: 'jsonb', nullable: true })
  executionLog: Record<string, any>[]; // Step-by-step execution log

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'triggered_by' })
  triggeredBy: User;

  @Column({ type: 'varchar', length: 100, nullable: true })
  triggerSource: string; // 'manual', 'scheduled', 'api', etc.

  @Column({ type: 'text', nullable: true })
  errorMessage: string;

  @Column({ type: 'integer', default: 0 })
  duration: number; // in milliseconds

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  completedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  nodeStates: Record<string, any>; // State of each node in the workflow

  @Column({ type: 'integer', default: 0 })
  nodeExecutionCount: number;

  @Column({ type: 'integer', default: 0 })
  successCount: number;

  @Column({ type: 'integer', default: 0 })
  failureCount: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  currentNode: string; // Current executing node ID

  @Column({ type: 'text', nullable: true })
  stackTrace: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  get isRunning(): boolean {
    return this.status === WorkflowExecutionStatus.RUNNING;
  }

  get isSuccessful(): boolean {
    return this.status === WorkflowExecutionStatus.COMPLETED && !this.errorMessage;
  }

  get hasError(): boolean {
    return this.status === WorkflowExecutionStatus.FAILED || this.failureCount > 0;
  }
}
