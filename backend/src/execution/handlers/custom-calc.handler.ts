import { evaluate } from 'mathjs';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { WorkflowNode } from '../../common/types/workflow.types';
import { Sensor } from '../../database/entities/Sensor.entity';
import { SensorData } from '../../database/entities/SensorData.entity';

interface TimePoint {
  timestamp: Date;
  value: number;
}

interface AlignedPoint {
  timestamp: Date;
  values: Record<string, number>;
}

const VARIABLE_LETTERS = ['a', 'b', 'c', 'd'] as const;

/**
 * CustomCalcHandler
 *
 * Fetches sensor data for up to 4 named variables (a, b, c, d),
 * aligns their time series, evaluates a user-defined math formula
 * at every aligned timestamp, then aggregates the result series
 * into a single output value.
 *
 * Properties consumed from node.data:
 *   formula          — math expression using variable names a/b/c/d
 *   stationA/sensorA — sensor bound to variable "a" (same for B/C/D)
 *   timeMode         — "all_data" | "custom_range"
 *   startDate        — ISO string, used when timeMode = custom_range
 *   endDate          — ISO string, used when timeMode = custom_range
 *   resampleStrategy — "interpolate" | "forward_fill" | "downsample"
 *   downsampleAgg    — "mean" | "min" | "max" | "sum" (downsample only)
 *   aggregation      — "mean" | "min" | "max" | "sum" | "last"
 */
export class CustomCalcHandler {
  constructor(
    private readonly sensorRepo:     Repository<Sensor>,
    private readonly sensorDataRepo: Repository<SensorData>,
  ) {}

  // ── Entry point ─────────────────────────────────────────────────────────────

  async execute(node: WorkflowNode, _input: unknown) {
    try {
      const formula = String(node.data?.formula ?? '').trim();
      if (!formula) return { error: 'No formula configured', branch: 'error' };

      // Collect sensor IDs for a/b/c/d
      const variables: Record<string, string> = {};
      for (const letter of VARIABLE_LETTERS) {
        const key = `sensor${letter.toUpperCase()}`;
        const sid = String(node.data?.[key] ?? '').trim();
        if (sid) variables[letter] = sid;
      }

      if (Object.keys(variables).length === 0) {
        return { error: 'No sensors configured (set sensorA, sensorB, …)', branch: 'error' };
      }

      // Time range
      const { startDate, endDate } = this.resolveTimeRange(node);

      // Fetch raw time series for every variable
      const seriesMap: Record<string, TimePoint[]> = {};
      for (const [letter, sensorId] of Object.entries(variables)) {
        const sensor = await this.sensorRepo.findOne({ where: { id: sensorId } });
        if (!sensor) {
          return { error: `Sensor for variable "${letter}" (id: ${sensorId}) not found`, branch: 'error' };
        }
        const series = await this.fetchSeries(sensorId, startDate, endDate);
        if (series.length === 0) {
          return { error: `No data found for variable "${letter}" sensor in the selected time range`, branch: 'error' };
        }
        seriesMap[letter] = series;
      }

      // Align time series
      const resampleStrategy = String(node.data?.resampleStrategy ?? 'interpolate');
      const downsampleAgg    = String(node.data?.downsampleAgg    ?? 'mean');
      const aligned          = this.alignSeries(seriesMap, resampleStrategy, downsampleAgg);

      if (aligned.length === 0) {
        return { error: 'Time series alignment produced no data points', branch: 'error' };
      }

      // Evaluate formula at every aligned timestamp
      const series = this.evaluateFormula(formula, aligned);

      if (series.length === 0) {
        return { error: 'Formula produced no valid numeric results — check variable names and formula syntax', branch: 'error' };
      }

      // Aggregate the result series → single output value
      const aggregation = String(node.data?.aggregation ?? 'mean');
      const result      = this.aggregate(series.map(p => p.value), aggregation);
      const rounded     = Math.round(result * 10000) / 10000;

      return {
        result:      rounded,
        series,
        count:       series.length,
        formula,
        aggregation,
        resampleStrategy,
        variables:   Object.keys(variables),
        branch:      'result',
      };
    } catch (err) {
      return {
        error:  err instanceof Error ? err.message : String(err),
        branch: 'error',
      };
    }
  }

  // ── Time range ───────────────────────────────────────────────────────────────

  private resolveTimeRange(node: WorkflowNode): { startDate?: Date; endDate?: Date } {
    const timeMode = String(node.data?.timeMode ?? 'all_data');
    if (timeMode !== 'custom_range') return {};

    const startDate = node.data?.startDate ? new Date(String(node.data.startDate)) : undefined;
    const endDate   = node.data?.endDate   ? new Date(String(node.data.endDate))   : undefined;
    return { startDate, endDate };
  }

  // ── Data fetching ────────────────────────────────────────────────────────────

  private async fetchSeries(
    sensorId: string,
    start?: Date,
    end?: Date,
  ): Promise<TimePoint[]> {
    // Build TypeORM where clause
    let timestampWhere: any = undefined;
    if (start && end) timestampWhere = Between(start, end);
    else if (start)   timestampWhere = MoreThanOrEqual(start);
    else if (end)     timestampWhere = LessThanOrEqual(end);

    const where: any = { sensor: { id: sensorId } };
    if (timestampWhere) where.timestamp = timestampWhere;

    const records = await this.sensorDataRepo.find({
      where,
      order:    { timestamp: 'ASC' },
      take:     50_000, // safety cap
      relations: ['sensor'],
    });

    return records.map(r => ({
      timestamp: r.timestamp,
      value:     Number(r.value),
    }));
  }

  // ── Time series alignment ────────────────────────────────────────────────────

  private alignSeries(
    seriesMap: Record<string, TimePoint[]>,
    strategy:  string,
    downsampleAgg: string,
  ): AlignedPoint[] {
    const letters = Object.keys(seriesMap);

    // Single variable — no alignment needed
    if (letters.length === 1) {
      const [letter] = letters;
      return seriesMap[letter].map(p => ({
        timestamp: p.timestamp,
        values:    { [letter]: p.value },
      }));
    }

    if (strategy === 'downsample') {
      return this.downsampleAlign(seriesMap, downsampleAgg);
    }

    // Find the densest series to use as time reference
    const refLetter = letters.reduce((best, l) =>
      seriesMap[l].length >= seriesMap[best].length ? l : best,
    letters[0]);
    const refSeries = seriesMap[refLetter];

    return refSeries.map(refPoint => {
      const values: Record<string, number> = { [refLetter]: refPoint.value };

      for (const letter of letters) {
        if (letter === refLetter) continue;
        values[letter] = strategy === 'forward_fill'
          ? this.forwardFill(seriesMap[letter], refPoint.timestamp)
          : this.interpolate(seriesMap[letter],  refPoint.timestamp);
      }

      return { timestamp: refPoint.timestamp, values };
    });
  }

  // Linear interpolation
  private interpolate(series: TimePoint[], ts: Date): number {
    if (series.length === 0) return 0;
    if (series.length === 1) return series[0].value;

    const t = ts.getTime();

    // Clamp to bounds
    if (t <= series[0].timestamp.getTime())                  return series[0].value;
    if (t >= series[series.length - 1].timestamp.getTime()) return series[series.length - 1].value;

    // Binary search for surrounding pair
    let lo = 0;
    let hi = series.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (series[mid].timestamp.getTime() <= t) lo = mid;
      else hi = mid;
    }

    const t0 = series[lo].timestamp.getTime();
    const t1 = series[hi].timestamp.getTime();
    if (t1 === t0) return series[lo].value;

    const ratio = (t - t0) / (t1 - t0);
    return series[lo].value + ratio * (series[hi].value - series[lo].value);
  }

  // Step / forward-fill
  private forwardFill(series: TimePoint[], ts: Date): number {
    const t = ts.getTime();
    let last = series[0].value;
    for (const point of series) {
      if (point.timestamp.getTime() <= t) last = point.value;
      else break;
    }
    return last;
  }

  // Downsample: bucket all series to the lowest-frequency grid
  private downsampleAlign(
    seriesMap: Record<string, TimePoint[]>,
    agg: string,
  ): AlignedPoint[] {
    const letters = Object.keys(seriesMap);

    // Identify the sparsest series (longest avg interval) as the grid reference
    let maxAvgInterval = 0;
    let gridLetter = letters[0];

    for (const letter of letters) {
      const s = seriesMap[letter];
      if (s.length < 2) continue;
      const avgInterval =
        (s[s.length - 1].timestamp.getTime() - s[0].timestamp.getTime()) / (s.length - 1);
      if (avgInterval > maxAvgInterval) {
        maxAvgInterval = avgInterval;
        gridLetter    = letter;
      }
    }

    const grid = seriesMap[gridLetter];
    const result: AlignedPoint[] = [];

    for (let i = 0; i < grid.length; i++) {
      const bucketStart = grid[i].timestamp.getTime();
      const bucketEnd   = i < grid.length - 1
        ? grid[i + 1].timestamp.getTime()
        : bucketStart + maxAvgInterval;

      const values: Record<string, number> = { [gridLetter]: grid[i].value };

      for (const letter of letters) {
        if (letter === gridLetter) continue;
        const bucket = seriesMap[letter].filter(p => {
          const t = p.timestamp.getTime();
          return t >= bucketStart && t < bucketEnd;
        });

        values[letter] = bucket.length > 0
          ? this.aggValues(bucket.map(p => p.value), agg)
          : this.forwardFill(seriesMap[letter], grid[i].timestamp);
      }

      result.push({ timestamp: grid[i].timestamp, values });
    }

    return result;
  }

  // ── Formula evaluation ───────────────────────────────────────────────────────

  private evaluateFormula(
    formula: string,
    aligned: AlignedPoint[],
  ): { timestamp: Date; value: number }[] {
    const results: { timestamp: Date; value: number }[] = [];

    for (const point of aligned) {
      try {
        const raw = evaluate(formula, { ...point.values });
        const val = typeof raw === 'number' ? raw : Number(raw);
        if (isFinite(val)) {
          results.push({ timestamp: point.timestamp, value: val });
        }
      } catch {
        // Skip timestamps where formula evaluation fails (e.g. division by zero)
      }
    }

    return results;
  }

  // ── Aggregation helpers ──────────────────────────────────────────────────────

  private aggValues(values: number[], agg: string): number {
    if (values.length === 0) return 0;
    switch (agg) {
      case 'min': return Math.min(...values);
      case 'max': return Math.max(...values);
      case 'sum': return values.reduce((s, v) => s + v, 0);
      default:    return values.reduce((s, v) => s + v, 0) / values.length; // mean
    }
  }

  private aggregate(values: number[], method: string): number {
    if (values.length === 0) return 0;
    switch (method) {
      case 'min':  return Math.min(...values);
      case 'max':  return Math.max(...values);
      case 'sum':  return values.reduce((s, v) => s + v, 0);
      case 'last': return values[values.length - 1];
      default:     return values.reduce((s, v) => s + v, 0) / values.length; // mean
    }
  }
}
