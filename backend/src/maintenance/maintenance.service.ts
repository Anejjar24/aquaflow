import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Maintenance } from '../database/entities/Maintenance.entity';
import { Station } from '../database/entities/Station.entity';
import { User } from '../database/entities/User.entity';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';
import { MaintenanceQueryDto } from './dto/maintenance-query.dto';
import { UpdateMaintenanceDto } from './dto/update-maintenance.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(Maintenance)
    private readonly maintenanceRepository: Repository<Maintenance>,
    @InjectRepository(Station)
    private readonly stationRepository: Repository<Station>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateMaintenanceDto, user: User) {
    const station = await this.stationRepository.findOne({ where: { id: dto.stationId } });
    if (!station) throw new NotFoundException(`Station "${dto.stationId}" was not found`);

    const assignedTo = dto.assignedToId
      ? await this.userRepository.findOne({ where: { id: dto.assignedToId } })
      : null;
    if (dto.assignedToId && !assignedTo) throw new NotFoundException(`User "${dto.assignedToId}" was not found`);

    const maintenance = this.maintenanceRepository.create({
      title: dto.title,
      type: dto.type,
      status: dto.status,
      priority: dto.priority,
      description: dto.description,
      station,
      createdBy: user,
      assignedTo: assignedTo || undefined,
      equipment: dto.equipment,
      partNumber: dto.partNumber,
      estimatedCost: dto.estimatedCost,
      estimatedDuration: dto.estimatedDuration,
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : undefined,
      notes: dto.notes,
      metadata: dto.metadata,
    });

    return this.maintenanceRepository.save(maintenance);
  }

  async findAll(query: MaintenanceQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, any> = {};

    if (query.stationId) where.station = { id: query.stationId };
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.priority) where.priority = query.priority;

    const [data, total] = await this.maintenanceRepository.findAndCount({
      where,
      relations: ['station', 'createdBy', 'assignedTo'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
      relations: ['station', 'createdBy', 'assignedTo'],
    });
    if (!maintenance) throw new NotFoundException(`Maintenance "${id}" was not found`);
    return maintenance;
  }

  async update(id: string, dto: UpdateMaintenanceDto) {
    const maintenance = await this.findOne(id);
    const { stationId, assignedToId, scheduledDate, startedAt, completedAt, ...payload } = dto;

    Object.assign(maintenance, payload);
    if (stationId) {
      const station = await this.stationRepository.findOne({ where: { id: stationId } });
      if (!station) throw new NotFoundException(`Station "${stationId}" was not found`);
      maintenance.station = station;
    }
    if (assignedToId) {
      const assignedTo = await this.userRepository.findOne({ where: { id: assignedToId } });
      if (!assignedTo) throw new NotFoundException(`User "${assignedToId}" was not found`);
      maintenance.assignedTo = assignedTo;
    }
    if (scheduledDate) maintenance.scheduledDate = new Date(scheduledDate);
    if (startedAt) maintenance.startedAt = new Date(startedAt);
    if (completedAt) maintenance.completedAt = new Date(completedAt);

    return this.maintenanceRepository.save(maintenance);
  }

  async remove(id: string) {
    const maintenance = await this.findOne(id);
    await this.maintenanceRepository.remove(maintenance);
    return { deleted: true, id };
  }
}
