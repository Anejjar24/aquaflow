import { IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
import { WorkflowGraph } from '../../common/types/workflow.types';
import { WorkflowTriggerType } from '../../database/entities/Workflow.entity';

export class CreateFlowDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsObject()
  graph!: WorkflowGraph;

  @IsEnum(WorkflowTriggerType)
  @IsOptional()
  triggerType?: WorkflowTriggerType;

  @IsObject()
  @IsOptional()
  triggerConfig?: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
