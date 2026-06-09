import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  TECHNICIAN = 'technician',
  ANALYST = 'analyst',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 100 })
  firstname: string;

  @Column({ type: 'varchar', length: 100 })
  lastname: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.OPERATOR,
  })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany('Station', 'createdBy')
  stations: any[];

  @OneToMany('Maintenance', 'assignedTo')
  assignedMaintenances: any[];

  @OneToMany('Maintenance', 'createdBy')
  createdMaintenances: any[];

  @OneToMany('Workflow', 'createdBy')
  createdWorkflows: any[];

  get fullName(): string {
    return `${this.firstname} ${this.lastname}`;
  }
}
