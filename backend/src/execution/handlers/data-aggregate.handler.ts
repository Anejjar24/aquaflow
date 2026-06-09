import { Repository } from 'typeorm';
import { WorkflowNode } from '../../common/types/workflow.types';
import { Sensor } from '../../database/entities/Sensor.entity';

/**
 * DataAggregateHandler
 *
 * Operations:
 *   stats          — descriptive statistics (min/max/avg/median/stddev/p95) on an array
 *   station_stats  — aggregates all sensors of a type in a station
 *   event_counter  — counts items; fires threshold_reached when count ≥ limit
 *   trend          — linear-regression slope → rising / falling / stable
 *   moving_average — rolling average over last N values
 */
export class DataAggregateHandler {
  constructor(private readonly sensorRepo: Repository<Sensor>) {}

  async execute(node: WorkflowNode, input: unknown) {
    const operation = String(node.data?.operation || 'stats');

    try {
      switch (operation) {
        case 'stats':          return this.stats(input);
        case 'station_stats':  return await this.stationStats(node);
        case 'event_counter':  return this.eventCounter(node, input);
        case 'trend':          return this.trend(node, input);
        case 'moving_average': return this.movingAverage(node, input);
        default:               return { value: input, branch: 'out' };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), branch: 'error' };
    }
  }

  // ── stats ──────────────────────────────────────────────────────────────────

  private stats(input: unknown) {
    const values = this.numericArray(input);
    if (values.length === 0) return { error: 'No numeric values found in input', branch: 'error' };

    const r      = (v: number) => Math.round(v * 1000) / 1000;
    const sorted = [...values].sort((a, b) => a - b);
    const n      = values.length;
    const sum    = values.reduce((s, v) => s + v, 0);
    const avg    = sum / n;
    const median = n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];
    const variance = values.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / n;
    const stddev   = Math.sqrt(variance);
    const p95      = sorted[Math.min(Math.ceil(n * 0.95) - 1, n - 1)];

    return {
      count:  n,
      sum:    r(sum),
      min:    r(sorted[0]),
      max:    r(sorted[n - 1]),
      avg:    r(avg),
      median: r(median),
      stddev: r(stddev),
      p95:    r(p95),
      branch: 'out',
    };
  }

  // ── station_stats ──────────────────────────────────────────────────────────

  private async stationStats(node: WorkflowNode) {
    const stationId  = String(node.data?.stationId  || '').trim();
    const sensorType = String(node.data?.sensorType || 'all').trim();

    if (!stationId) return { error: 'stationId not configured', branch: 'error' };

    const qb = this.sensorRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.station', 'station')
      .where('station.id = :stationId', { stationId });

    if (sensorType !== 'all') qb.andWhere('s.type = :type', { type: sensorType });

    const sensors = await qb.getMany();

    const readings = sensors
      .filter(s => s.lastReading != null)
      .map(s => Number(s.lastReading));

    const r = (v: number) => Math.round(v * 1000) / 1000;
    const aggregates = readings.length > 0 ? {
      min: r(Math.min(...readings)),
      max: r(Math.max(...readings)),
      avg: r(readings.reduce((s, v) => s + v, 0) / readings.length),
    } : { min: null, max: null, avg: null };

    return {
      stationId,
      sensorType,
      count:       sensors.length,
      activeCount: sensors.filter(s => s.status === 'active').length,
      sensors: sensors.map(s => ({
        id:     s.id,
        name:   s.name,
        value:  s.lastReading != null ? Number(s.lastReading) : null,
        unit:   s.unit,
        status: s.status,
      })),
      ...aggregates,
      branch: 'out',
    };
  }

  // ── event_counter ──────────────────────────────────────────────────────────

  private eventCounter(node: WorkflowNode, input: unknown) {
    const items         = Array.isArray(input) ? input : [input];
    const count         = items.length;
    const threshold     = Number(node.data?.countThreshold ?? 5);
    const windowSeconds = Number(node.data?.windowSeconds ?? 60);

    return {
      count,
      threshold,
      windowSeconds,
      thresholdReached: count >= threshold,
      branch: count >= threshold ? 'threshold_reached' : 'out',
    };
  }

  // ── trend ──────────────────────────────────────────────────────────────────
  // Simple linear regression: computes slope of best-fit line through
  // (index, value) pairs.  Positive slope → rising, negative → falling.

  private trend(node: WorkflowNode, input: unknown) {
    const values = this.numericArray(input);
    if (values.length < 2) return { error: 'At least 2 values required for trend detection', branch: 'error' };

    const winSize = Math.min(Number(node.data?.windowSize ?? 10), values.length);
    const window  = [...values.slice(0, winSize)].reverse(); // oldest → newest

    const n     = window.length;
    const sumX  = window.reduce((s, _, i) => s + i,     0);
    const sumY  = window.reduce((s, v)    => s + v,     0);
    const sumXY = window.reduce((s, v, i) => s + i * v, 0);
    const sumX2 = window.reduce((s, _, i) => s + i * i, 0);

    const denom = n * sumX2 - sumX * sumX;
    const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
    const stableTol = 0.01;

    let branch: string;
    if      (slope >  stableTol) branch = 'rising';
    else if (slope < -stableTol) branch = 'falling';
    else                         branch = 'stable';

    return {
      slope:      Math.round(slope * 10000) / 10000,
      direction:  branch,
      windowSize: n,
      branch,
    };
  }

  // ── moving_average ─────────────────────────────────────────────────────────

  private movingAverage(node: WorkflowNode, input: unknown) {
    const values  = this.numericArray(input);
    if (values.length === 0) return { error: 'No numeric values in input', branch: 'error' };

    const winSize = Math.min(Number(node.data?.windowSize ?? 10), values.length);
    const window  = values.slice(0, winSize);
    const avg     = window.reduce((s, v) => s + v, 0) / window.length;

    return {
      value:       Math.round(avg * 10000) / 10000,
      windowSize:  window.length,
      sampleCount: values.length,
      branch:      'out',
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private numericArray(input: unknown): number[] {
    if (Array.isArray(input)) return input.map(Number).filter(v => !isNaN(v));
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      if (Array.isArray(obj['readings'])) {
        return (obj['readings'] as any[]).map(r => Number(r.value)).filter(v => !isNaN(v));
      }
      if (Array.isArray(obj['sensors'])) {
        return (obj['sensors'] as any[]).map(s => Number(s.value)).filter(v => !isNaN(v));
      }
      if (Array.isArray(obj['items'])) {
        return (obj['items'] as any[]).map(Number).filter(v => !isNaN(v));
      }
    }
    return typeof input === 'number' ? [input] : [];
  }
}
