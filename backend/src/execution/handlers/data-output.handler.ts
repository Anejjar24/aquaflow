import { Repository } from 'typeorm';
import { WorkflowNode } from '../../common/types/workflow.types';
import { Sensor } from '../../database/entities/Sensor.entity';
import { SensorData } from '../../database/entities/SensorData.entity';

/**
 * DataOutputHandler
 *
 * Operations:
 *   log            — explicitly stores a value into the sensor time-series DB
 *   report_builder — assembles a structured report object from the input data
 *   csv_format     — converts an array of records into a CSV string
 *   enrich         — attaches station/sensor metadata to a bare { sensorId, value } object
 */
export class DataOutputHandler {
  constructor(
    private readonly sensorDataRepo: Repository<SensorData>,
    private readonly sensorRepo:     Repository<Sensor>,
  ) {}

  async execute(node: WorkflowNode, input: unknown) {
    const operation = String(node.data?.operation || 'report_builder');

    try {
      switch (operation) {
        case 'log':            return await this.log(node, input);
        case 'report_builder': return this.reportBuilder(node, input);
        case 'csv_format':     return this.csvFormat(node, input);
        case 'enrich':         return await this.enrich(node, input);
        default:               return { value: input, branch: 'out' };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err), branch: 'error' };
    }
  }

  // ── log ────────────────────────────────────────────────────────────────────
  // Writes a numeric value to the sensor_data time-series table and updates
  // the sensor's lastReading / lastReadingAt fields.

  private async log(node: WorkflowNode, input: unknown) {
    const sensorId = String(node.data?.sensorId || '').trim();
    if (!sensorId) return { error: 'sensorId not configured', branch: 'error' };

    const sensor = await this.sensorRepo.findOne({ where: { id: sensorId } });
    if (!sensor) return { error: `Sensor "${sensorId}" not found`, branch: 'error' };

    const value = this.numericValue(input);
    if (isNaN(value)) return { error: 'Cannot extract a numeric value from input', branch: 'error' };

    const rawTags = String(node.data?.tags || '').trim();
    let tags: Record<string, unknown> = {};
    if (rawTags) {
      try { tags = JSON.parse(rawTags); } catch { /* ignore malformed tags */ }
    }

    const now    = new Date();
    const record = this.sensorDataRepo.create({ sensor, value, timestamp: now, source: 'workflow' });
    const saved  = await this.sensorDataRepo.save(record);

    await this.sensorRepo.update(sensorId, { lastReading: value, lastReadingAt: now });

    return { recordId: saved.id, sensorId, value, timestamp: now, tags, branch: 'saved' };
  }

  // ── report_builder ─────────────────────────────────────────────────────────

  private reportBuilder(node: WorkflowNode, input: unknown) {
    const title        = String(node.data?.reportTitle || 'Sensor Report');
    const includeStats = String(node.data?.includeStats ?? 'yes') !== 'no';

    const rows   = this.toArray(input).slice(0, 100);
    const nums   = rows.map(r => {
      if (typeof r === 'number') return r;
      const o = r as Record<string, unknown>;
      return Number(o?.['value'] ?? o?.['v'] ?? NaN);
    }).filter(v => !isNaN(v));

    const stats = includeStats && nums.length > 0 ? {
      count:  nums.length,
      min:    Math.round(Math.min(...nums) * 1000) / 1000,
      max:    Math.round(Math.max(...nums) * 1000) / 1000,
      avg:    Math.round(nums.reduce((s, v) => s + v, 0) / nums.length * 1000) / 1000,
    } : undefined;

    const report = {
      title,
      generatedAt:  new Date().toISOString(),
      readingCount: rows.length,
      readings:     rows,
      ...(stats ? { stats } : {}),
    };

    return { report, branch: 'report' };
  }

  // ── csv_format ─────────────────────────────────────────────────────────────

  private csvFormat(node: WorkflowNode, input: unknown) {
    const columnsStr    = String(node.data?.columns       || 'timestamp,value,unit');
    const delimiter     = String(node.data?.delimiter     || ',').replace('\\t', '\t');
    const includeHeader = String(node.data?.includeHeader ?? 'yes') !== 'no';

    const columns = columnsStr.split(',').map(c => c.trim()).filter(Boolean);
    const rows    = this.toArray(input);

    const lines: string[] = [];
    if (includeHeader) lines.push(columns.join(delimiter));

    rows.forEach(row => {
      const obj   = typeof row === 'object' && row !== null ? row as Record<string, unknown> : { value: row };
      const cells = columns.map(col => {
        const v = obj[col];
        if (v === undefined || v === null) return '';
        const s = String(v);
        return s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
      });
      lines.push(cells.join(delimiter));
    });

    return { csv: lines.join('\n'), rowCount: rows.length, columns, branch: 'csv' };
  }

  // ── enrich ─────────────────────────────────────────────────────────────────
  // Attaches sensor + station metadata to the input object.
  // sensorId is read from input.sensorId first, then from node config.

  private async enrich(node: WorkflowNode, input: unknown) {
    const obj      = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
    const sensorId = String(obj['sensorId'] ?? node.data?.sensorId ?? '').trim();

    if (!sensorId) return { ...obj, branch: 'out' };

    const sensor = await this.sensorRepo.findOne({
      where: { id: sensorId },
      relations: ['station'],
    });
    if (!sensor) return { ...obj, enriched: false, branch: 'out' };

    return {
      ...obj,
      value:        obj['value'] ?? sensor.lastReading,
      sensorId:     sensor.id,
      sensorName:   sensor.name,
      sensorType:   sensor.type,
      unit:         sensor.unit,
      location:     sensor.location,
      minThreshold: sensor.minThreshold,
      maxThreshold: sensor.maxThreshold,
      stationId:    sensor.station?.id   ?? null,
      stationName:  sensor.station?.name ?? null,
      enrichedAt:   new Date().toISOString(),
      enriched:     true,
      branch:       'out',
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private numericValue(input: unknown): number {
    if (typeof input === 'number') return input;
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      const v   = obj['value'] ?? obj['current'] ?? obj['normalized'];
      if (v !== undefined) return Number(v);
    }
    return Number(input);
  }

  private toArray(input: unknown): unknown[] {
    if (Array.isArray(input)) return input;
    if (typeof input === 'object' && input !== null) {
      const obj = input as Record<string, unknown>;
      if (Array.isArray(obj['readings'])) return obj['readings'] as unknown[];
      if (Array.isArray(obj['sensors']))  return obj['sensors']  as unknown[];
      if (Array.isArray(obj['items']))    return obj['items']    as unknown[];
      if (Array.isArray(obj['data']))     return obj['data']     as unknown[];
    }
    return [input];
  }
}
