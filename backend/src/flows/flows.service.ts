import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Workflow, WorkflowTriggerType } from '../database/entities/Workflow.entity';
import { WorkflowExecution } from '../database/entities/WorkflowExecution.entity';
import { User } from '../database/entities/User.entity';
import { CreateFlowDto } from './dto/create-flow.dto';
import { FlowValidatorService } from './flow-validator.service';

@Injectable()
export class FlowsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowExecution)
    private readonly executionRepository: Repository<WorkflowExecution>,
    private readonly validator: FlowValidatorService,
  ) {}

  async create(dto: CreateFlowDto, user: User) {
    this.validator.validate(dto.graph);
    const id = dto.graph.id || randomUUID();
    const workflow = this.workflowRepository.create({
      id,
      name: dto.name || (dto.graph.name as string) || 'Untitled workflow',
      graph: { ...dto.graph, id },
      createdBy: user,
      triggerType: dto.triggerType ?? WorkflowTriggerType.MANUAL,
      triggerConfig: dto.triggerConfig ?? {},
      isActive: dto.isActive ?? false,
    });
    return this.workflowRepository.save(workflow);
  }

  async findAll() {
    return this.workflowRepository.find({
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const workflow = await this.workflowRepository.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!workflow) throw new NotFoundException(`Workflow "${id}" was not found.`);
    return workflow;
  }

  async update(id: string, dto: CreateFlowDto, user?: User) {
    const workflow = await this.findOne(id);
    this.validator.validate(dto.graph);
    workflow.name = dto.name || workflow.name;
    workflow.graph = { ...dto.graph, id };
    if (dto.triggerType !== undefined) workflow.triggerType = dto.triggerType;
    if (dto.triggerConfig !== undefined) workflow.triggerConfig = dto.triggerConfig;
    if (dto.isActive !== undefined) workflow.isActive = dto.isActive;
    if (user) workflow.updatedBy = user;
    return this.workflowRepository.save(workflow);
  }

  async activate(id: string): Promise<Workflow> {
    const workflow = await this.findOne(id);
    workflow.isActive = true;
    return this.workflowRepository.save(workflow);
  }

  async deactivate(id: string): Promise<Workflow> {
    const workflow = await this.findOne(id);
    workflow.isActive = false;
    return this.workflowRepository.save(workflow);
  }

  async remove(id: string) {
    const workflow = await this.findOne(id);
    await this.workflowRepository.remove(workflow);
    return { deleted: true, id };
  }

  async getExecutions(workflowId: string) {
    await this.findOne(workflowId); // throws 404 if workflow doesn't exist
    return this.executionRepository.find({
      where: { workflow: { id: workflowId } },
      relations: ['triggeredBy'],
      order: { startedAt: 'DESC' },
      take: 50,
    });
  }
}
