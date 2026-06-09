import { IsObject, IsOptional } from 'class-validator';
import { WorkflowGraph } from '../../common/types/workflow.types';

export class ExecuteFlowDto {
  @IsObject()
  graph!: WorkflowGraph;

  @IsObject()
  @IsOptional()
  input?: Record<string, unknown>;
}
