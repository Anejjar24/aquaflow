import { WorkflowNode } from '../../common/types/workflow.types';

export class DecisionHandler {
  execute(node: WorkflowNode, input: unknown) {
    const current = Number(input);
    const compareTo = Number(node.data?.compareTo ?? 0);
    const operator = String(node.data?.operator || '>');

    const passed =
      operator === '>' ? current > compareTo :
      operator === '>=' ? current >= compareTo :
      operator === '<' ? current < compareTo :
      operator === '<=' ? current <= compareTo :
      operator === '==' ? current === compareTo :
      operator === '!=' ? current !== compareTo :
      false;

    return { value: input, branch: passed ? 'true' : 'false', passed };
  }
}
