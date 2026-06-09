import { Repository } from 'typeorm';
import { WorkflowNode } from '../../common/types/workflow.types';
import { Sensor } from '../../database/entities/Sensor.entity';
import { SensorData } from '../../database/entities/SensorData.entity';

/**
 * SensorReadHandler
 *
 * Operations:
 *   single       — reads the latest value of one sensor (original behaviour)
 *   history      — returns the last N time-series records for a sensor
 *   batch        — reads all sensors of a given type in a station
 *   status_check — determines whether a sensor is online or offline
 *   delta        — computes the change between the two most recent readings
 */
export class SensorReadHandler {
  constructor(
    private readonly sensorRepo:     Repository<Sensor>,
    private readonly sensorDataRepo: Repository<SensorData>,
  ) {}

  async execute(node: WorkflowNode, _input: unknown) {
    const operation = String(node.data?.operation || 'single');

    switch (operation) {
      case 'history':      return this.executeHistory(node);
      case 'batch':        return this.executeBatch(node);
      case 'status_check': return this.executeStatusCheck(node);
      case 'delta':        return this.executeDelta(node);
      default:             return this.executeSingle(node);   // 'single'
    }
  }

  // ── single ────────────────────────────────────────────────────────────────

  private async executeSingle(node: WorkflowNode) {
    const sensorId = String(node.data?.sensorId || '').trim();
    if (!sensorId) return { error: 'sensorId not configured', value: null };

    const sensor = await this.sensorRepo.findOne({
      where: { id: sensorId },
      relations: ['station'],
    });
    if (!sensor) return { error: `Sensor "${sensorId}" not found`, value: null, status: 'not_found' };

    return {
      sensorId:  sensor.id,
      name:      sensor.name,
      value:     sensor.lastReading,
      unit:      sensor.unit,
      timestamp: sensor.lastReadingAt,
      status:    sensor.status,
      stationId: sensor.station?.id ?? null,
    };
  }

  // ── history ───────────────────────────────────────────────────────────────

  private async executeHistory(node: WorkflowNode) {
    const sensorId = String(node.data?.sensorId || '').trim();
    if (!sensorId) return { error: 'sensorId not configured', readings: [], branch: 'error' };

    const limit     = Math.min(Number(node.data?.limit ?? 10), 100);
    const timeRange = String(node.data?.timeRange || 'last_24h');

    const rangeMs: Record<string, number> = {
      last_hour: 60 * 60 * 1000,
      last_6h:   6  * 60 * 60 * 1000,
      last_24h:  24 * 60 * 60 * 1000,
      last_week: 7  * 24 * 60 * 60 * 1000,
    };
    const since = new Date(Date.now() - (rangeMs[timeRange] ?? rangeMs.last_24h));

    const records = await this.sensorDataRepo
      .createQueryBuilder('sd')
      .where('sd.sensor_id = :sensorId', { sensorId })
      .andWhere('sd.timestamp >= :since', { since })
      .orderBy('sd.timestamp', 'DESC')
      .take(limit)
      .getMany();

    const readings = records.map(r => ({
      id:        r.id,
      value:     Number(r.value),
      timestamp: r.timestamp,
    }));

    return { readings, count: readings.length, sensorId, branch: 'readings' };
  }

  // ── batch ─────────────────────────────────────────────────────────────────

  private async executeBatch(node: WorkflowNode) {
    const stationId  = String(node.data?.stationId  || '').trim();
    const sensorType = String(node.data?.sensorType || 'all').trim();
    const limit      = Math.min(Number(node.data?.limit ?? 20), 100);

    const qb = this.sensorRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.station', 'station');

    if (stationId)              qb.where('station.id = :stationId', { stationId });
    if (sensorType !== 'all')   qb.andWhere('s.type = :type', { type: sensorType });

    const sensors = await qb.take(limit).getMany();

    const result = sensors.map(s => ({
      sensorId:    s.id,
      name:        s.name,
      type:        s.type,
      value:       s.lastReading != null ? Number(s.lastReading) : null,
      unit:        s.unit,
      status:      s.status,
      timestamp:   s.lastReadingAt,
      stationId:   s.station?.id   ?? null,
      stationName: s.station?.name ?? null,
    }));

    return { sensors: result, count: result.length, branch: 'sensors' };
  }

  // ── status_check ──────────────────────────────────────────────────────────

  private async executeStatusCheck(node: WorkflowNode) {
    const sensorId         = String(node.data?.sensorId || '').trim();
    const offlineTimeoutMin = Number(node.data?.offlineTimeout ?? 5);

    if (!sensorId) return { error: 'sensorId not configured', branch: 'error' };

    const sensor = await this.sensorRepo.findOne({ where: { id: sensorId } });
    if (!sensor) return { error: `Sensor "${sensorId}" not found`, branch: 'error' };

    if (!sensor.lastReadingAt) {
      return { sensorId, name: sensor.name, status: 'offline', reason: 'never_reported', branch: 'offline' };
    }

    const minutesSince = (Date.now() - sensor.lastReadingAt.getTime()) / 60_000;
    const isOffline    = minutesSince > offlineTimeoutMin
                      || sensor.status === 'offline'
                      || sensor.status === 'faulty';

    return {
      sensorId,
      name:          sensor.name,
      status:        sensor.status,
      lastReadingAt: sensor.lastReadingAt,
      minutesSince:  Math.round(minutesSince * 10) / 10,
      branch:        isOffline ? 'offline' : 'online',
    };
  }

  // ── delta ─────────────────────────────────────────────────────────────────

  private async executeDelta(node: WorkflowNode) {
    const sensorId          = String(node.data?.sensorId || '').trim();
    const deltaThresholdPct = Number(node.data?.deltaThreshold ?? 5);

    if (!sensorId) return { error: 'sensorId not configured', branch: 'error' };

    const records = await this.sensorDataRepo
      .createQueryBuilder('sd')
      .where('sd.sensor_id = :sensorId', { sensorId })
      .orderBy('sd.timestamp', 'DESC')
      .take(2)
      .getMany();

    if (records.length < 2) {
      const sensor = await this.sensorRepo.findOne({ where: { id: sensorId } });
      if (!sensor || sensor.lastReading == null) {
        return { error: 'Not enough readings for delta computation', branch: 'error' };
      }
      return {
        sensorId,
        current: Number(sensor.lastReading),
        previous: null,
        change: null,
        changePercent: null,
        direction: 'unknown',
        significant: false,
        value: Number(sensor.lastReading),
        branch: 'stable',
      };
    }

    const current  = Number(records[0].value);
    const previous = Number(records[1].value);
    const change   = current - previous;
    const changePct = previous !== 0 ? (change / Math.abs(previous)) * 100 : 0;
    const significant = Math.abs(changePct) >= deltaThresholdPct;

    return {
      sensorId,
      current,
      previous,
      change:        Math.round(change   * 1000) / 1000,
      changePercent: Math.round(changePct * 100)  / 100,
      direction:     change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      significant,
      value: current,   // compatibility alias
      branch: significant ? 'significant' : 'stable',
    };
  }
}
