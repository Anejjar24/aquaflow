import { WorkflowNode } from '../../common/types/workflow.types';

export class OutputHandler {
  execute(node: WorkflowNode, input: unknown) {
    if (node.data?.format === 'number') return Number(input);
    if (node.data?.format === 'text') return String(input);
    return input;
  }
}
