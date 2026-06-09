import { WorkflowNode } from '../../common/types/workflow.types';

// ── Unit conversion table ─────────────────────────────────────────────────────
// Each entry maps  from[to] = (value: number) => convertedValue
type ConvFn = (v: number) => number;
const CONV: Record<string, Record<string, ConvFn>> = {
  // Temperature
  C:     { F: v => v * 9 / 5 + 32,                K: v => v + 273.15,              C: v => v },
  F:     { C: v => (v - 32) * 5 / 9,              K: v => (v - 32) * 5 / 9 + 273.15, F: v => v },
  K:     { C: v => v - 273.15,                    F: v => (v - 273.15) * 9 / 5 + 32, K: v => v },
  // Pressure
  bar:   { psi: v => v * 14.5038,  mbar: v => v * 1000,   Pa: v => v * 100_000, bar:  v => v },
  psi:   { bar: v => v / 14.5038,  mbar: v => v * 68.948, Pa: v => v * 6894.76, psi:  v => v },
  mbar:  { bar: v => v / 1000,     psi:  v => v / 68.948, Pa: v => v * 100,     mbar: v => v },
  Pa:    { bar: v => v / 100_000,  psi:  v => v / 6894.76, mbar: v => v / 100,  Pa:   v => v },
  // Flow
  'm3/h': { 'L/s': v => v / 3.6,   'L/min': v => v / 0.06,  'm3/h': v => v },
  'L/s':  { 'm3/h': v => v * 3.6,  'L/min': v => v * 60,    'L/s':  v => v },
  'L/min':{ 'm3/h': v => v * 0.06, 'L/s':   v => v / 60,    'L/min':v => v },
  // Length / Level
  m:  { ft: v => v * 3.28084, cm: v => v * 100,    m:  v => v },
  ft: { m:  v => v / 3.28084, cm: v => v * 30.48,  ft: v => v },
  cm: { m:  v => v / 100,     ft: v => v / 30.48,  cm: v => v },
};

function r(v: number, d = 4) {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

/**
 * ValueTransformHandler
 *
 * Operations:
 *   normalize    — scales value from [inputMin, inputMax] to [outputMin, outputMax]
 *   unit_convert — converts between physical units (°C↔°F, bar↔psi, m³/h↔L/s …)
 *   round        — rounds to N decimal places (round / floor / ceil)
 *   clamp        — clips to physical range; routes clamped/fault values to separate ports
 *   map          — maps discrete numeric states to human-readable labels
 */
export class ValueTransformHandler {
  execute(node: WorkflowNode, input: unknown) {
    const operation = String(node.data?.operation || 'normalize');
    const raw = this.extractNumeric(input);

    try {
      switch (operation) {
        case 'normalize':    return this.normalize(node, raw);
        case 'unit_convert': return this.unitConvert(node, raw);
        case 'round':        return this.round(node, raw);
        case 'clamp':        return this.clamp(node, raw);
        case 'map':          return this.map(node, raw);
        default:             return { value: raw, branch: 'out' };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), branch: 'fault' };
    }
  }

  // ── normalize ──────────────────────────────────────────────────────────────

  private normalize(node: WorkflowNode, value: number) {
    const inMin  = Number(node.data?.inputMin  ?? 0);
    const inMax  = Number(node.data?.inputMax  ?? 100);
    const outMin = Number(node.data?.outputMin ?? 0);
    const outMax = Number(node.data?.outputMax ?? 100);

    if (inMax === inMin) throw new Error('inputMin and inputMax must be different');

    const normalized = ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
    return { value: r(normalized), original: value, branch: 'out' };
  }

  // ── unit_convert ───────────────────────────────────────────────────────────

  private unitConvert(node: WorkflowNode, value: number) {
    const from = String(node.data?.fromUnit || 'C');
    const to   = String(node.data?.toUnit   || 'F');

    const fn = CONV[from]?.[to];
    if (!fn) throw new Error(`No conversion defined from "${from}" to "${to}"`);

    return { value: r(fn(value)), original: value, fromUnit: from, toUnit: to, branch: 'out' };
  }

  // ── round ──────────────────────────────────────────────────────────────────

  private round(node: WorkflowNode, value: number) {
    const decimals  = Math.max(0, Number(node.data?.decimals ?? 2));
    const mode      = String(node.data?.roundMode || 'round');
    const factor    = Math.pow(10, decimals);

    const rounded =
      mode === 'floor' ? Math.floor(value * factor) / factor :
      mode === 'ceil'  ? Math.ceil (value * factor) / factor :
                         Math.round(value * factor) / factor;

    return { value: rounded, original: value, branch: 'out' };
  }

  // ── clamp ──────────────────────────────────────────────────────────────────

  private clamp(node: WorkflowNode, value: number) {
    const min = Number(node.data?.inputMin ?? -Infinity);
    const max = Number(node.data?.inputMax ??  Infinity);

    if (value < min || value > max) {
      const clamped = Math.min(max, Math.max(min, value));
      return { value: clamped, original: value, outOfRange: true, branch: 'clamped' };
    }
    return { value, original: value, outOfRange: false, branch: 'out' };
  }

  // ── map ────────────────────────────────────────────────────────────────────

  private map(node: WorkflowNode, value: number) {
    let mappings: Record<string, string> = {};
    try {
      mappings = JSON.parse(String(node.data?.mappings || '{}'));
    } catch {
      throw new Error('mappings field contains invalid JSON');
    }

    // Try exact match first, then integer rounded match
    const label = mappings[String(value)] ?? mappings[String(Math.round(value))];
    if (label === undefined) return { value, label: null, branch: 'unknown' };

    return { value, label, branch: 'out' };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private extractNumeric(input: unknown): number {
    if (typeof input === 'number') return input;
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      const v   = obj['value'] ?? obj['normalized'] ?? obj['current'];
      if (v !== undefined) return Number(v);
    }
    return Number(input);
  }
}
