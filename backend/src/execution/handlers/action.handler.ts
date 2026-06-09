import { WorkflowNode } from '../../common/types/workflow.types';

export class ActionHandler {
  execute(node: WorkflowNode, input: unknown) {
    const operation = String(node.data?.operation || 'identity');
    const factor = Number(node.data?.factor ?? 1);
    const numericInput = Number(input);

    if (operation === 'multiply') return numericInput * factor;
    if (operation === 'add') return numericInput + factor;
    if (operation === 'subtract') return numericInput - factor;
    if (operation === 'divide') return factor === 0 ? numericInput : numericInput / factor;
    if (operation === 'uppercase') return String(input).toUpperCase();
    if (operation === 'append') return `${input}${node.data?.text || ''}`;

    return input;
  }
}
