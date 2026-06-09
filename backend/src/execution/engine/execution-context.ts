import { ExecutionStep } from '../../common/types/workflow.types';

export class ExecutionContext {
  private readonly values = new Map<string, unknown>();
  readonly steps: ExecutionStep[] = [];

  constructor(readonly input: Record<string, unknown> = {}) {}

  setValue(nodeId: string, value: unknown) {
    this.values.set(nodeId, value);
  }

  getValue(nodeId: string) {
    return this.values.get(nodeId);
  }

  addStep(step: ExecutionStep) {
    this.steps.push(step);
  }
}
