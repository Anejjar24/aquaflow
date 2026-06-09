import { WorkflowNode } from '../../common/types/workflow.types';
import { ExecutionContext } from '../engine/execution-context';

export class InputHandler {
  execute(node: WorkflowNode, context: ExecutionContext) {
    const raw = node.data?.value ?? context.input;

    // When the node's value is a plain string (typed into the UI text field),
    // try to parse it as JSON so that objects, arrays, and numbers entered in
    // the Input node actually arrive at downstream nodes as the correct type.
    //
    // Examples:
    //   '{"temperature":23.5}'  → { temperature: 23.5 }   (object)
    //   '[1,2,3]'               → [1, 2, 3]                (array)
    //   '42'                    → 42                        (number)
    //   'hello'                 → 'hello'                   (string, parse fails)
    //   'true'                  → true                      (boolean)
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        // Not valid JSON — return the original string unchanged.
      }
    }

    return raw;
  }
}
