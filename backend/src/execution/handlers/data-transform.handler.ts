import { WorkflowNode } from '../../common/types/workflow.types';

/**
 * Executes a data-transform node.
 *
 * Supported operations
 * ────────────────────
 * extract_field   — returns input[field]  (unwraps one key from an object)
 * set_field       — returns { ...input, [field]: value }
 * delete_field    — returns a shallow copy of input without the named key
 * to_number       — Number(input)
 * to_string       — String(input)
 * parse_json      — JSON.parse(String(input))
 * stringify_json  — JSON.stringify(input)
 *
 * Port routing
 * ────────────
 * Success  → { value: <transformed>, branch: 'out' }
 * Failure  → { error: <message>,     branch: 'error' }
 *
 * The `branch` field is consumed by WorkflowRunner.filterDecisionEdges so only
 * the correct outgoing port is activated — matching the pattern used by
 * decision, threshold-check, and http-request handlers.
 */
export class DataTransformHandler {
  execute(node: WorkflowNode, input: unknown) {
    const operation = String(node.data?.operation || 'extract_field');
    const field = String(node.data?.field ?? '');
    const setValue = node.data?.value;

    try {
      const transformed = this.transform(operation, input, field, setValue);
      return { value: transformed, branch: 'out' };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
        branch: 'error',
      };
    }
  }

  private transform(
    operation: string,
    input: unknown,
    field: string,
    setValue: unknown,
  ): unknown {
    // Coerce to object for field-level operations; use empty object as fallback
    // so the operation still returns a meaningful result instead of throwing.
    const obj =
      typeof input === 'object' && input !== null
        ? (input as Record<string, unknown>)
        : {};

    switch (operation) {
      // ── Field-level mutations ────────────────────────────────────────────────
      case 'extract_field': {
        if (!field) throw new Error('"field" is required for extract_field');
        return obj[field];
      }

      case 'set_field': {
        if (!field) throw new Error('"field" is required for set_field');
        return { ...obj, [field]: setValue };
      }

      case 'delete_field': {
        if (!field) throw new Error('"field" is required for delete_field');
        const copy = { ...obj };
        delete copy[field];
        return copy;
      }

      // ── Type coercions ───────────────────────────────────────────────────────
      case 'to_number':
        return Number(input);

      case 'to_string':
        return String(input);

      case 'parse_json':
        // Will throw a SyntaxError — caught by the caller → error port.
        return JSON.parse(String(input));

      case 'stringify_json':
        return JSON.stringify(input);

      // ── Unknown operation — pass through unchanged ───────────────────────────
      default:
        return input;
    }
  }
}
