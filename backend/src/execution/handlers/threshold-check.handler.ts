import { WorkflowNode } from '../../common/types/workflow.types';

export class ThresholdCheckHandler {
  execute(node: WorkflowNode, input: unknown) {
    // sensor-read passes a full object { value, sensorId, … }.
    // Accept that shape as well as a bare number/string.
    const raw =
      typeof input === 'object' &&
      input !== null &&
      'value' in (input as Record<string, unknown>)
        ? (input as Record<string, unknown>).value
        : input;
    const value = Number(raw);
    const min = node.data?.minThreshold != null ? Number(node.data.minThreshold) : null;
    const max = node.data?.maxThreshold != null ? Number(node.data.maxThreshold) : null;
    const mode = String(node.data?.mode || 'between');

    let breach = false;

    if (mode === 'between') {
      if (min !== null && value < min) breach = true;
      if (max !== null && value > max) breach = true;
    } else if (mode === 'above_max') {
      breach = max !== null && value > max;
    } else if (mode === 'below_min') {
      breach = min !== null && value < min;
    }

    return {
      value,
      breach,
      pass: !breach,
      min,
      max,
      mode,
      branch: breach ? 'breach' : 'pass',
    };
  }
}
