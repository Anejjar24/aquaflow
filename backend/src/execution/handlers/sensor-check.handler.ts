import { WorkflowNode } from '../../common/types/workflow.types';

/**
 * SensorCheckHandler
 *
 * Operations:
 *   multi_threshold — routes to normal / warning / critical / emergency
 *   rate_of_change  — detects too-fast / too-slow value changes
 *   deadband        — suppresses events when change is below the dead-band width
 *   anomaly         — Z-score outlier detection on an array of values
 *   compare         — compares valueA vs valueB (from dual inputs)
 *   time_window     — gates execution to configured hours / days of week
 */
export class SensorCheckHandler {
  execute(node: WorkflowNode, input: unknown) {
    const operation = String(node.data?.operation || 'multi_threshold');

    try {
      switch (operation) {
        case 'multi_threshold': return this.multiThreshold(node, input);
        case 'rate_of_change':  return this.rateOfChange(node, input);
        case 'deadband':        return this.deadband(node, input);
        case 'anomaly':         return this.anomaly(node, input);
        case 'compare':         return this.compare(node, input);
        case 'time_window':     return this.timeWindow(node);
        default:                return { value: input, branch: 'normal' };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), branch: 'normal' };
    }
  }

  // ── multi_threshold ────────────────────────────────────────────────────────

  private multiThreshold(node: WorkflowNode, input: unknown) {
    const value     = this.num(input);
    const warning   = Number(node.data?.warningThreshold   ?? 60);
    const critical  = Number(node.data?.criticalThreshold  ?? 80);
    const emergency = Number(node.data?.emergencyThreshold ?? 95);

    let branch: string;
    if      (value >= emergency) branch = 'emergency';
    else if (value >= critical)  branch = 'critical';
    else if (value >= warning)   branch = 'warning';
    else                         branch = 'normal';

    return { value, level: branch, warningThreshold: warning, criticalThreshold: critical, emergencyThreshold: emergency, branch };
  }

  // ── rate_of_change ─────────────────────────────────────────────────────────
  // Expects the output of sensor-read delta:
  //   { current, previous, change, changePercent, direction }
  // Falls back to { current, previous, timeDeltaMs } or bare numbers.

  private rateOfChange(node: WorkflowNode, input: unknown) {
    const obj  = this.obj(input);
    const curr = Number(obj['current']     ?? obj['value'] ?? input);
    const prev = Number(obj['previous']    ?? 0);
    const dtMs = Number(obj['timeDeltaMs'] ?? 1000);

    const change     = curr - prev;
    const ratePerSec = dtMs > 0 ? (change / dtMs) * 1000 : change;

    const maxRate = Number(node.data?.maxRatePerSec ??  Infinity);
    const minRate = Number(node.data?.minRatePerSec ?? -Infinity);

    let branch: string;
    if      (ratePerSec >  maxRate) branch = 'too_fast';
    else if (ratePerSec <  minRate) branch = 'too_slow';
    else                            branch = 'normal';

    return { current: curr, previous: prev, ratePerSec: Math.round(ratePerSec * 1000) / 1000, branch };
  }

  // ── deadband ───────────────────────────────────────────────────────────────
  // Expects { current, previous } or sensor-read delta output.

  private deadband(node: WorkflowNode, input: unknown) {
    const obj     = this.obj(input);
    const current = Number(obj['current']  ?? obj['value']  ?? input);
    const previous= Number(obj['previous'] ?? 0);
    const rawChange = Math.abs(current - previous);

    const width = Number(node.data?.deadbandWidth ?? 2);
    const mode  = String(node.data?.deadbandMode || 'absolute');

    const effective = mode === 'percent'
      ? (previous !== 0 ? (rawChange / Math.abs(previous)) * 100 : rawChange)
      : rawChange;

    const changed = effective > width;
    return { current, previous, change: Math.round(effective * 1000) / 1000, deadbandWidth: width, branch: changed ? 'changed' : 'suppressed' };
  }

  // ── anomaly ────────────────────────────────────────────────────────────────
  // Expects an array of numeric values (newest first) from sensor-read history.

  private anomaly(node: WorkflowNode, input: unknown) {
    const values = this.numericArray(input);
    if (values.length < 3) {
      return { error: 'At least 3 values required for anomaly detection', branch: 'normal' };
    }

    const winSize   = Math.min(Number(node.data?.windowSize ?? 20), values.length);
    const window    = values.slice(0, winSize);
    const current   = window[0];

    const mean    = window.reduce((s, v) => s + v, 0) / window.length;
    const variance= window.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / window.length;
    const stddev  = Math.sqrt(variance);
    const zscore  = stddev > 0 ? Math.abs((current - mean) / stddev) : 0;
    const threshold = Number(node.data?.zscoreThreshold ?? 3);

    return {
      value:     current,
      zscore:    Math.round(zscore * 1000) / 1000,
      mean:      Math.round(mean   * 1000) / 1000,
      stddev:    Math.round(stddev * 1000) / 1000,
      isAnomaly: zscore > threshold,
      branch:    zscore > threshold ? 'anomaly' : 'normal',
    };
  }

  // ── compare ────────────────────────────────────────────────────────────────
  // Expects { valueA, valueB } — e.g. from two sensor-read blocks merged via
  // a data-transform set_field step.

  private compare(node: WorkflowNode, input: unknown) {
    const obj = this.obj(input);
    const a   = Number(obj['valueA'] ?? obj['a'] ?? 0);
    const b   = Number(obj['valueB'] ?? obj['b'] ?? 0);
    const tol = Number(node.data?.tolerance ?? 0.01);

    const diff = a - b;
    if (Math.abs(diff) <= tol) return { valueA: a, valueB: b, diff, branch: 'equal'     };
    if (a > b)                 return { valueA: a, valueB: b, diff, branch: 'a_greater'  };
                               return { valueA: a, valueB: b, diff, branch: 'b_greater'  };
  }

  // ── time_window ────────────────────────────────────────────────────────────

  private timeWindow(node: WorkflowNode) {
    const now       = new Date();
    const startStr  = String(node.data?.startTime  || '08:00');
    const endStr    = String(node.data?.endTime     || '18:00');
    const daysStr   = String(node.data?.daysOfWeek  || '1,2,3,4,5');

    const allowedDays = daysStr.split(',').map(d => parseInt(d.trim(), 10));
    const day         = now.getDay();   // 0 = Sun, 6 = Sat

    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr  .split(':').map(Number);
    const nowMin   = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin   = eh * 60 + em;

    const dayOk  = allowedDays.includes(day);
    const timeOk = nowMin >= startMin && nowMin < endMin;

    return {
      currentTime: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      currentDay: day,
      dayAllowed: dayOk,
      timeAllowed: timeOk,
      branch: dayOk && timeOk ? 'allowed' : 'blocked',
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private num(input: unknown): number {
    if (typeof input === 'number') return input;
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      const v   = obj['value'] ?? obj['current'];
      if (v !== undefined) return Number(v);
    }
    return Number(input);
  }

  private obj(input: unknown): Record<string, unknown> {
    return typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};
  }

  private numericArray(input: unknown): number[] {
    if (Array.isArray(input)) {
      return input.map(Number).filter(v => !isNaN(v));
    }
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      // sensor-read history output: { readings: [{ value, timestamp }] }
      if (Array.isArray(obj['readings'])) {
        return (obj['readings'] as any[]).map(r => Number(r.value)).filter(v => !isNaN(v));
      }
    }
    return typeof input === 'number' ? [input] : [];
  }
}
