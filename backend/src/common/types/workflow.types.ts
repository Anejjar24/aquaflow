export type WorkflowNodeType =
  | 'input'
  | 'output'
  | 'action'
  | 'decision'
  | 'delay'
  | 'api'
  | 'notification'
  // Data blocks
  | 'data-transform'
  // Industrial blocks — core
  | 'sensor-read'
  | 'threshold-check'
  | 'pump-control'
  | 'alert-trigger'
  | 'mqtt-publish'
  | 'station-control'
  // Industrial blocks — extended
  | 'value-transform'
  | 'sensor-check'
  | 'data-aggregate'
  | 'stream-filter'
  | 'data-output'
  // Integration blocks
  | 'http-request'
  // Custom calculation
  | 'custom-calc';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  data?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  sourcePort?: string | null;
  targetPort?: string | null;
}

export interface WorkflowGraph {
  id?: string;
  name?: string;
  version?: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface ExecutionStep {
  nodeId: string;
  type: WorkflowNodeType;
  input: unknown;
  output: unknown;
}

export interface ExecutionResult {
  workflowId?: string;
  status: 'success' | 'failed';
  output: unknown;
  steps: ExecutionStep[];
}
