import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FlowsService } from './flows.service';
import { Workflow, WorkflowTriggerType } from '../database/entities/Workflow.entity';
import { WorkflowExecution } from '../database/entities/WorkflowExecution.entity';
import { User } from '../database/entities/User.entity';
import { FlowValidatorService } from './flow-validator.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeGraph = () => ({
  id: 'graph-uuid',
  nodes: [{ id: 'n1', type: 'input' }, { id: 'n2', type: 'output' }],
  edges: [{ source: 'n1', target: 'n2' }],
});

const makeWorkflow = (overrides: Partial<Workflow> = {}): Workflow =>
  ({
    id: 'workflow-uuid',
    name: 'Test Workflow',
    graph: makeGraph(),
    triggerType: WorkflowTriggerType.MANUAL,
    triggerConfig: {},
    isActive: false,
    createdBy: null,
    updatedBy: null,
    ...overrides,
  } as unknown as Workflow);

const makeUser = (): User => ({ id: 'user-uuid', name: 'Admin' } as unknown as User);

const makeCreateDto = (overrides: Record<string, any> = {}) => ({
  name: 'Test Workflow',
  graph: makeGraph(),
  triggerType: WorkflowTriggerType.MANUAL,
  triggerConfig: {},
  isActive: false,
  ...overrides,
});

const mockWorkflowRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })) as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
  findOne: jest.fn() as jest.MockedFunction<any>,
  find: jest.fn() as jest.MockedFunction<any>,
  remove: jest.fn() as jest.MockedFunction<any>,
});

const mockWorkflowExecutionRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })) as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
  findOne: jest.fn() as jest.MockedFunction<any>,
  find: jest.fn() as jest.MockedFunction<any>,
  findAndCount: jest.fn().mockResolvedValue([[], 0]) as jest.MockedFunction<any>,
});

const mockFlowValidator = () => ({
  validate: jest.fn().mockReturnValue(true) as jest.MockedFunction<any>,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FlowsService', () => {
  let service: FlowsService;
  let workflowRepo: ReturnType<typeof mockWorkflowRepo>;
  let executionRepo: ReturnType<typeof mockWorkflowExecutionRepo>;
  let validator: ReturnType<typeof mockFlowValidator>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowsService,
        { provide: getRepositoryToken(Workflow), useFactory: mockWorkflowRepo },
        { provide: getRepositoryToken(WorkflowExecution), useFactory: mockWorkflowExecutionRepo },
        { provide: FlowValidatorService, useFactory: mockFlowValidator },
      ],
    }).compile();

    service = module.get(FlowsService);
    workflowRepo = module.get(getRepositoryToken(Workflow));
    executionRepo = module.get(getRepositoryToken(WorkflowExecution));
    validator = module.get(FlowValidatorService);

    // Default return values
    workflowRepo.save.mockResolvedValue(makeWorkflow());
    workflowRepo.findOne.mockResolvedValue(null);
    workflowRepo.find.mockResolvedValue([]);
    workflowRepo.remove.mockResolvedValue(undefined);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('validates the graph before saving', async () => {
      const dto = makeCreateDto();
      workflowRepo.save.mockResolvedValue(makeWorkflow());

      await service.create(dto as any, makeUser());

      expect(validator.validate).toHaveBeenCalledWith(dto.graph);
    });

    it('creates and saves the workflow', async () => {
      const dto = makeCreateDto();
      const saved = makeWorkflow({ name: 'Test Workflow' });
      workflowRepo.save.mockResolvedValue(saved);

      const result = await service.create(dto as any, makeUser());

      expect(workflowRepo.create).toHaveBeenCalled();
      expect(workflowRepo.save).toHaveBeenCalled();
      expect(result).toEqual(saved);
    });

    it('uses graph.id as workflow id when graph.id is provided', async () => {
      const dto = makeCreateDto({ graph: { ...makeGraph(), id: 'my-graph-id' } });
      workflowRepo.save.mockResolvedValue(makeWorkflow());

      await service.create(dto as any, makeUser());

      expect(workflowRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'my-graph-id' }),
      );
    });

    it('defaults isActive to false when not provided', async () => {
      const dto = makeCreateDto({ isActive: undefined });
      workflowRepo.save.mockResolvedValue(makeWorkflow());

      await service.create(dto as any, makeUser());

      expect(workflowRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('defaults triggerType to MANUAL when not provided', async () => {
      const dto = makeCreateDto({ triggerType: undefined });
      workflowRepo.save.mockResolvedValue(makeWorkflow());

      await service.create(dto as any, makeUser());

      expect(workflowRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ triggerType: WorkflowTriggerType.MANUAL }),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns all workflows', async () => {
      const workflows = [makeWorkflow(), makeWorkflow({ id: 'workflow-2' })];
      workflowRepo.find.mockResolvedValue(workflows);

      const result = await service.findAll();

      expect(result).toEqual(workflows);
      expect(workflowRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['createdBy'] }),
      );
    });

    it('returns empty array when no workflows exist', async () => {
      workflowRepo.find.mockResolvedValue([]);
      await expect(service.findAll()).resolves.toEqual([]);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns workflow when found', async () => {
      const workflow = makeWorkflow();
      workflowRepo.findOne.mockResolvedValue(workflow);

      await expect(service.findOne('workflow-uuid')).resolves.toEqual(workflow);
    });

    it('throws NotFoundException when workflow does not exist', async () => {
      workflowRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('validates graph and saves updated workflow', async () => {
      const existing = makeWorkflow();
      workflowRepo.findOne.mockResolvedValue(existing);
      const updated = makeWorkflow({ name: 'Renamed' });
      workflowRepo.save.mockResolvedValue(updated);
      const dto = makeCreateDto({ name: 'Renamed' });

      const result = await service.update('workflow-uuid', dto as any);

      expect(validator.validate).toHaveBeenCalledWith(dto.graph);
      expect(workflowRepo.save).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('sets updatedBy when user is provided', async () => {
      const existing = makeWorkflow();
      workflowRepo.findOne.mockResolvedValue(existing);
      workflowRepo.save.mockResolvedValue(existing);
      const user = makeUser();

      await service.update('workflow-uuid', makeCreateDto() as any, user);

      expect(existing.updatedBy).toEqual(user);
    });

    it('updates triggerType and isActive when provided in dto', async () => {
      const existing = makeWorkflow();
      workflowRepo.findOne.mockResolvedValue(existing);
      workflowRepo.save.mockResolvedValue(existing);
      const dto = makeCreateDto({
        triggerType: WorkflowTriggerType.SCHEDULED,
        isActive: true,
      });

      await service.update('workflow-uuid', dto as any);

      expect(existing.triggerType).toBe(WorkflowTriggerType.SCHEDULED);
      expect(existing.isActive).toBe(true);
    });

    it('throws NotFoundException when workflow does not exist', async () => {
      workflowRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', makeCreateDto() as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── activate ──────────────────────────────────────────────────────────────

  describe('activate', () => {
    it('sets isActive to true and saves', async () => {
      const workflow = makeWorkflow({ isActive: false });
      workflowRepo.findOne.mockResolvedValue(workflow);
      workflowRepo.save.mockResolvedValue({ ...workflow, isActive: true });

      const result = await service.activate('workflow-uuid');

      expect(workflow.isActive).toBe(true);
      expect(workflowRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true }),
      );
      expect(result).toHaveProperty('isActive', true);
    });

    it('throws NotFoundException when workflow does not exist', async () => {
      workflowRepo.findOne.mockResolvedValue(null);

      await expect(service.activate('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('sets isActive to false and saves', async () => {
      const workflow = makeWorkflow({ isActive: true });
      workflowRepo.findOne.mockResolvedValue(workflow);
      workflowRepo.save.mockResolvedValue({ ...workflow, isActive: false });

      const result = await service.deactivate('workflow-uuid');

      expect(workflow.isActive).toBe(false);
      expect(workflowRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(result).toHaveProperty('isActive', false);
    });

    it('throws NotFoundException when workflow does not exist', async () => {
      workflowRepo.findOne.mockResolvedValue(null);

      await expect(service.deactivate('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes workflow and returns { deleted: true, id }', async () => {
      const workflow = makeWorkflow();
      workflowRepo.findOne.mockResolvedValue(workflow);

      const result = await service.remove('workflow-uuid');

      expect(workflowRepo.remove).toHaveBeenCalledWith(workflow);
      expect(result).toEqual({ deleted: true, id: 'workflow-uuid' });
    });

    it('throws NotFoundException when workflow does not exist', async () => {
      workflowRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
