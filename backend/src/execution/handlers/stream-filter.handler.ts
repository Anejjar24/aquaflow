import { WorkflowNode } from '../../common/types/workflow.types';

/**
 * StreamFilterHandler
 *
 * Controls event flow rate and detects burst patterns.
 *
 * Note: true temporal debounce/throttle requires state between executions.
 * These operations are meaningful when the input is an ARRAY of events
 * (e.g. from sensor-read history or batch).  For single-value inputs they
 * pass through immediately with a note.
 *
 * Operations:
 *   debounce     — passes only the latest value in a set; useful to collapse
 *                  an array of events to the most recent one
 *   throttle     — keeps the first of every N events in an array
 *   sample       — returns every Nth item from an array (downsampling)
 *   burst_detect — fires "burst" port when the input array exceeds the threshold
 */
export class StreamFilterHandler {
  execute(node: WorkflowNode, input: unknown) {
    const operation = String(node.data?.operation || 'sample');

    try {
      switch (operation) {
        case 'debounce':     return this.debounce(node, input);
        case 'throttle':     return this.throttle(node, input);
        case 'sample':       return this.sample(node, input);
        case 'burst_detect': return this.burstDetect(node, input);
        default:             return { value: input, branch: 'fired' };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), branch: 'fired' };
    }
  }

  // ── debounce ───────────────────────────────────────────────────────────────
  // Array: collapses to the single most-recent item (index 0 = newest).
  // Single: passes straight through.

  private debounce(node: WorkflowNode, input: unknown) {
    const intervalMs = Number(node.data?.intervalMs ?? 500);

    if (Array.isArray(input) && input.length > 0) {
      return {
        value:        input[0],  // newest
        suppressed:   input.length - 1,
        originalCount:input.length,
        intervalMs,
        branch: 'fired',
      };
    }

    return { value: input, intervalMs, branch: 'fired' };
  }

  // ── throttle ───────────────────────────────────────────────────────────────
  // Keeps only the FIRST event of every N-event window.

  private throttle(node: WorkflowNode, input: unknown) {
    const intervalMs = Number(node.data?.intervalMs ?? 500);
    const keepEvery  = Math.max(1, Math.round(intervalMs / 100));

    if (Array.isArray(input)) {
      const kept = input.filter((_, i) => i % keepEvery === 0);
      return {
        items:         kept,
        originalCount: input.length,
        keptCount:     kept.length,
        intervalMs,
        branch: 'allowed',
      };
    }

    return { value: input, intervalMs, branch: 'allowed' };
  }

  // ── sample ─────────────────────────────────────────────────────────────────
  // Returns every Nth item — reduces data volume while preserving shape.

  private sample(node: WorkflowNode, input: unknown) {
    const sampleEvery = Math.max(1, Number(node.data?.sampleEvery ?? 5));

    if (Array.isArray(input)) {
      const sampled = input.filter((_, i) => i % sampleEvery === 0);
      return {
        items:         sampled,
        originalCount: input.length,
        sampledCount:  sampled.length,
        sampleRate:    `1 of every ${sampleEvery}`,
        branch: 'fired',
      };
    }

    // Single value always passes
    return { value: input, sampleEvery, branch: 'fired' };
  }

  // ── burst_detect ───────────────────────────────────────────────────────────
  // Fires "burst" port when the number of items exceeds the configured threshold.

  private burstDetect(node: WorkflowNode, input: unknown) {
    const burstCount    = Number(node.data?.burstCount    ?? 10);
    const burstWindowMs = Number(node.data?.burstWindowMs ?? 1000);

    const items   = Array.isArray(input) ? input : [input];
    const count   = items.length;
    const isBurst = count >= burstCount;

    return {
      count,
      burstThreshold: burstCount,
      burstWindowMs,
      isBurst,
      items: isBurst ? items : undefined,
      branch: isBurst ? 'burst' : 'normal',
    };
  }
}
