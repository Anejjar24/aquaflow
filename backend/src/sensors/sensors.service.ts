import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { Sensor } from '../database/entities/Sensor.entity';
import { SensorData } from '../database/entities/SensorData.entity';
import { Station } from '../database/entities/Station.entity';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { SensorQueryDto } from './dto/sensor-query.dto';
import { UpdateSensorDto } from './dto/update-sensor.dto';
import { RealtimeService } from '../realtime/realtime.service';

const SENSOR_LIST_TTL = 60; // seconds
const SENSOR_LIST_PREFIX = 'sensors:list:';

@Injectable()
export class SensorsService {
  /** Tracks active list cache keys so we can invalidate them on mutation */
  private readonly listCacheKeys = new Set<string>();

  constructor(
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    @InjectRepository(SensorData)
    private readonly sensorDataRepository: Repository<SensorData>,
    @InjectRepository(Station)
    private readonly stationRepository: Repository<Station>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @Optional() private readonly realtimeService?: RealtimeService,
  ) {}

  async create(dto: CreateSensorDto) {
    const station = await this.stationRepository.findOne({ where: { id: dto.stationId } });
    if (!station) throw new NotFoundException(`Station "${dto.stationId}" was not found`);

    const { stationId, ...sensorPayload } = dto;
    const sensor = this.sensorRepository.create({ ...sensorPayload, station });
    const saved = await this.sensorRepository.save(sensor);
    await this.clearListCache();
    return saved;
  }

  async findAll(query: SensorQueryDto): Promise<{ data: Sensor[]; meta: { total: number; page: number; limit: number; pages: number } }> {
    const cacheKey = `${SENSOR_LIST_PREFIX}${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get<{ data: Sensor[]; meta: { total: number; page: number; limit: number; pages: number } }>(cacheKey);
    if (cached) return cached;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, any> = {};

    if (query.stationId) where.station = { id: query.stationId };
    if (query.type) where.type = query.type;
    if (query.status) where.status = query.status;
    if (query.search) where.name = ILike(`%${query.search}%`);

    const [data, total] = await this.sensorRepository.findAndCount({
      where,
      relations: ['station'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const result = { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };

    await this.cacheManager.set(cacheKey, result, SENSOR_LIST_TTL * 1000);
    this.listCacheKeys.add(cacheKey);

    return result;
  }

  async findOne(id: string) {
    const sensor = await this.sensorRepository.findOne({
      where: { id },
      relations: ['station', 'alerts'],
    });
    if (!sensor) throw new NotFoundException(`Sensor "${id}" was not found`);
    return sensor;
  }

  async update(id: string, dto: UpdateSensorDto) {
    const sensor = await this.findOne(id);
    const { stationId, ...sensorPayload } = dto;

    Object.assign(sensor, sensorPayload);
    if (stationId) {
      const station = await this.stationRepository.findOne({ where: { id: stationId } });
      if (!station) throw new NotFoundException(`Station "${stationId}" was not found`);
      sensor.station = station;
    }

    const saved = await this.sensorRepository.save(sensor);
    await this.clearListCache();
    return saved;
  }

  async remove(id: string) {
    const sensor = await this.findOne(id);
    await this.sensorRepository.remove(sensor);
    await this.clearListCache();
    return { deleted: true, id };
  }

  async findData(sensorId: string, limit = 100) {
    await this.findOne(sensorId);
    return this.sensorDataRepository.find({
      where: { sensor: { id: sensorId } },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  /**
   * Manually inject a sensor reading — same effect as an MQTT message.
   * Updates lastReading / lastReadingAt on the sensor row, persists a
   * SensorData record, and returns the updated sensor.
   * Useful for testing flows in the Automation Builder without needing a
   * live MQTT device.
   */
  async injectReading(sensorId: string, value: number) {
    const sensor = await this.sensorRepository.findOne({
      where: { id: sensorId },
      relations: ['station'],
    });
    if (!sensor) throw new NotFoundException(`Sensor "${sensorId}" was not found`);

    sensor.lastReading = value;
    sensor.lastReadingAt = new Date();

    await this.sensorRepository.save(sensor);

    await this.sensorDataRepository.save(
      this.sensorDataRepository.create({
        sensor,
        value,
        timestamp: sensor.lastReadingAt,
        source: 'manual',
        qualityFlags: {},
      }),
    );

    await this.clearListCache();

    const result = {
      sensorId: sensor.id,
      name: sensor.name,
      value: sensor.lastReading,
      unit: sensor.unit,
      timestamp: sensor.lastReadingAt,
      status: sensor.status,
      station: sensor.station ? { id: sensor.station.id, name: sensor.station.name } : null,
    };

    // Emit real-time socket event so the Simulator Lab and monitoring dashboards
    // receive live updates exactly as they would from an MQTT-sourced reading.
    if (this.realtimeService) {
      const thresholdViolated =
        (sensor.minThreshold !== null && sensor.minThreshold !== undefined && value < Number(sensor.minThreshold)) ||
        (sensor.maxThreshold !== null && sensor.maxThreshold !== undefined && value > Number(sensor.maxThreshold));

      this.realtimeService.broadcastToAll('sensor-update', {
        sensorId: sensor.id,
        stationId: sensor.station?.id ?? null,
        value,
        timestamp: sensor.lastReadingAt,
        thresholdViolated,
        status: sensor.status,
        source: 'simulator',
      });
    }

    return result;
  }

  async exportDataCsv(
    sensorId: string,
    limit: number,
    from?: string,
    to?: string,
  ): Promise<string> {
    const sensor = await this.findOne(sensorId); // validates existence, loads unit

    const where: Record<string, any> = { sensor: { id: sensorId } };
    if (from && to) {
      where.timestamp = Between(new Date(from), new Date(to));
    } else if (from) {
      where.timestamp = MoreThanOrEqual(new Date(from));
    } else if (to) {
      where.timestamp = LessThanOrEqual(new Date(to));
    }

    const data = await this.sensorDataRepository.find({
      where,
      order: { timestamp: 'DESC' },
      take: limit,
    });

    const header = 'id,timestamp,value,unit,source,accuracy';
    const rows = data.map((d) =>
      [
        d.id,
        d.timestamp?.toISOString() ?? '',
        d.value,
        sensor.unit ?? '',
        d.source ?? '',
        d.accuracy ?? '',
      ].join(',')
    );

    return [header, ...rows].join('\r\n');
  }

  private async clearListCache(): Promise<void> {
    for (const key of this.listCacheKeys) {
      await this.cacheManager.del(key);
    }
    this.listCacheKeys.clear();
  }
}
