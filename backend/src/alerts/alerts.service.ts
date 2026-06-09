import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { Alert, AlertStatus } from '../database/entities/Alert.entity';
import { Sensor } from '../database/entities/Sensor.entity';
import { Station } from '../database/entities/Station.entity';
import { User } from '../database/entities/User.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AlertQueryDto } from './dto/alert-query.dto';
import { CreateAlertDto } from './dto/create-alert.dto';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepository: Repository<Alert>,
    @InjectRepository(Station)
    private readonly stationRepository: Repository<Station>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    private readonly realtimeService: RealtimeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: CreateAlertDto) {
    const station = dto.stationId
      ? await this.stationRepository.findOne({ where: { id: dto.stationId } })
      : null;
    const sensor = dto.sensorId
      ? await this.sensorRepository.findOne({ where: { id: dto.sensorId } })
      : null;

    if (dto.stationId && !station) throw new NotFoundException(`Station "${dto.stationId}" was not found`);
    if (dto.sensorId && !sensor) throw new NotFoundException(`Sensor "${dto.sensorId}" was not found`);

    const alert = await this.alertRepository.save(
      this.alertRepository.create({
        type: dto.type,
        severity: dto.severity,
        message: dto.message,
        description: dto.description,
        data: dto.data,
        sourceSystem: dto.sourceSystem || 'aquaflow',
        station: station || undefined,
        sensor: sensor || undefined,
      }),
    );

    // Broadcast real-time alert event
    this.realtimeService.broadcastToAll('alert-created', {
      id: alert.id,
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      stationId: station?.id,
      station: station?.name,
      sensorId: sensor?.id,
      timestamp: alert.createdAt,
    });

    // Create in-app notification + email for critical alerts (fire-and-forget)
    this.notificationsService
      .notifyAlertCreated(alert, station, sensor)
      .catch(() => void 0); // never let notification failure break alert creation

    return alert;
  }

  async findAll(query: AlertQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, any> = {};

    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.type) where.type = query.type;
    if (query.stationId) where.station = { id: query.stationId };
    if (query.sensorId) where.sensor = { id: query.sensorId };

    const [data, total] = await this.alertRepository.findAndCount({
      where,
      relations: ['station', 'sensor', 'acknowledgedBy', 'resolvedBy'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const alert = await this.alertRepository.findOne({
      where: { id },
      relations: ['station', 'sensor', 'acknowledgedBy', 'resolvedBy'],
    });
    if (!alert) throw new NotFoundException(`Alert "${id}" was not found`);
    return alert;
  }

  async acknowledge(id: string, user: User) {
    const alert = await this.findOne(id);
    alert.status = AlertStatus.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = user;
    return this.alertRepository.save(alert);
  }

  async resolve(id: string, user: User) {
    const alert = await this.findOne(id);
    alert.status = AlertStatus.RESOLVED;
    alert.resolvedAt = new Date();
    alert.resolvedBy = user;
    return this.alertRepository.save(alert);
  }

  async exportCsv(params: {
    status?: string;
    severity?: string;
    type?: string;
    stationId?: string;
    sensorId?: string;
    from?: string;
    to?: string;
  }): Promise<string> {
    const where: Record<string, any> = {};
    if (params.status) where.status = params.status;
    if (params.severity) where.severity = params.severity;
    if (params.type) where.type = params.type;
    if (params.stationId) where.station = { id: params.stationId };
    if (params.sensorId) where.sensor = { id: params.sensorId };
    if (params.from && params.to) {
      where.createdAt = Between(new Date(params.from), new Date(params.to));
    } else if (params.from) {
      where.createdAt = MoreThanOrEqual(new Date(params.from));
    } else if (params.to) {
      where.createdAt = LessThanOrEqual(new Date(params.to));
    }

    const alerts = await this.alertRepository.find({
      where,
      relations: ['station', 'sensor'],
      order: { createdAt: 'DESC' },
      take: 10_000,
    });

    const esc = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;

    const header = 'id,type,severity,status,message,station,sensor,createdAt,acknowledgedAt,resolvedAt,sourceSystem';
    const rows = alerts.map((a) =>
      [
        a.id,
        a.type,
        a.severity,
        a.status,
        esc(a.message),
        esc(a.station?.name ?? ''),
        esc(a.sensor?.name ?? ''),
        a.createdAt?.toISOString() ?? '',
        a.acknowledgedAt?.toISOString() ?? '',
        a.resolvedAt?.toISOString() ?? '',
        esc(a.sourceSystem ?? ''),
      ].join(',')
    );

    return [header, ...rows].join('\r\n');
  }
}
