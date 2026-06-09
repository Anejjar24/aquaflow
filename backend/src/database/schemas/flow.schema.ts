import { WorkflowGraph } from '../../common/types/workflow.types';

export interface FlowRecord {
  id: string;
  name: string;
  graph: WorkflowGraph;
  createdAt: string;
  updatedAt: string;
}
