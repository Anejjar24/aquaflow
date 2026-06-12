/**
 * TEST D'INTÉGRATION #3 — Workflow : création + validation + cycle
 *
 * Ce test vérifie que FlowsService et FlowValidatorService
 * collaborent correctement : FlowsService délègue la validation
 * à FlowValidatorService avant toute persistance.
 *
 * Composants RÉELS :
 *   ✅ FlowsService        — création, activation, désactivation
 *   ✅ FlowValidatorService — détection de cycles, validité des nœuds
 *
 * Composants mockés :
 *   🔧 Repository<Workflow>          — pas de vraie DB
 *   🔧 Repository<WorkflowExecution> — pas de vraie DB
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FlowsService } from '../../src/flows/flows.service';
import { FlowValidatorService } from '../../src/flows/flow-validator.service';
import { Workflow, WorkflowTriggerType } from '../../src/database/entities/Workflow.entity';
import { WorkflowExecution } from '../../src/database/entities/WorkflowExecution.entity';
import { User } from '../../src/database/entities/User.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

const adminUser = { id: 'user-admin', email: 'admin@aquaflow.io' } as User;

// Helpers pour construire les graphes (cast as any pour les types de nœuds)
const node = (id: string, type: string) => ({ id, type } as any);
const edge = (source: string, target: string) => ({ source, target });

/** Graphe linéaire valide : capteur → seuil → alerte */
const graphValide: any = {
  id: 'graph-01',
  nodes: [node('n1', 'sensor-read'), node('n2', 'threshold-check'), node('n3', 'alert-trigger')],
  edges: [edge('n1', 'n2'), edge('n2', 'n3')],
};

/** Graphe avec cycle : n1 → n2 → n3 → n1 */
const graphAvecCycle: any = {
  id: 'graph-cycle',
  nodes: [node('n1', 'sensor-read'), node('n2', 'threshold-check'), node('n3', 'alert-trigger')],
  edges: [edge('n1', 'n2'), edge('n2', 'n3'), edge('n3', 'n1')], // ← cycle !
};

/** Graphe avec type de nœud invalide */
const graphNoeudInvalide: any = {
  id: 'graph-bad',
  nodes: [node('n1', 'sensor-read'), node('n2', 'type-inexistant')], // ← invalide
  edges: [edge('n1', 'n2')],
};

/** Graphe avec boucle sur soi-même */
const graphAutoRef: any = {
  id: 'graph-self',
  nodes: [node('n1', 'sensor-read')],
  edges: [edge('n1', 'n1')], // ← auto-référence
};

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('[Intégration] FlowsService + FlowValidatorService', () => {
  let module: TestingModule;
  let flowsService: FlowsService;
  let validatorService: FlowValidatorService;

  // DB en mémoire simple
  const workflowsDb: Map<string, Workflow> = new Map();

  const workflowRepo = {
    create: jest.fn((dto: any) => ({ ...dto, createdAt: new Date(), isActive: false } as Workflow)),
    save: jest.fn(async (w: any) => { workflowsDb.set(w.id, w); return w; }),
    findOne: jest.fn(async ({ where }: any) => workflowsDb.get(where.id) ?? null),
    find: jest.fn(async () => Array.from(workflowsDb.values())),
    remove: jest.fn(async (w: any) => { workflowsDb.delete(w.id); return w; }),
  };

  const executionRepo = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ ...d, id: 'exec-uuid' })),
    findOne: jest.fn(async () => null),
    find: jest.fn(async () => []),
    findAndCount: jest.fn(async () => [[], 0]),
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        // ✅ Services RÉELS
        FlowsService,
        FlowValidatorService,

        { provide: getRepositoryToken(Workflow),          useValue: workflowRepo },
        { provide: getRepositoryToken(WorkflowExecution), useValue: executionRepo },
      ],
    }).compile();

    module.useLogger(false);

    flowsService     = module.get(FlowsService);
    validatorService = module.get(FlowValidatorService);
  });

  afterAll(() => module.close());

  beforeEach(() => {
    workflowsDb.clear();
    jest.clearAllMocks();
    workflowRepo.create.mockImplementation((dto: any) => ({ ...dto, createdAt: new Date(), isActive: false } as Workflow));
    workflowRepo.save.mockImplementation(async (w: any) => { workflowsDb.set(w.id, w); return w; });
    workflowRepo.findOne.mockImplementation(async ({ where }: any) => workflowsDb.get(where.id) ?? null);
    workflowRepo.find.mockImplementation(async () => Array.from(workflowsDb.values()));
    workflowRepo.remove.mockImplementation(async (w: any) => { workflowsDb.delete(w.id); return w; });
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('graphe valide → FlowValidatorService valide + FlowsService persiste', async () => {
    const workflow = await flowsService.create(
      {
        name: 'Workflow Pompe',
        graph: graphValide,
        triggerType: WorkflowTriggerType.MANUAL,
        triggerConfig: {},
        isActive: false,
      },
      adminUser,
    );

    // ✅ FlowsService a persisté le workflow (via repo.save réel)
    expect(workflowRepo.save).toHaveBeenCalledTimes(1);
    expect(workflow.name).toBe('Workflow Pompe');
    expect(workflow.graph.nodes).toHaveLength(3);

    // ✅ Le workflow est bien dans la DB en mémoire
    expect(workflowsDb.has(workflow.id)).toBe(true);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('graphe avec cycle → FlowValidatorService détecte le cycle, rien persisté', async () => {
    await expect(
      flowsService.create(
        {
          name: 'Workflow Cyclique',
          graph: graphAvecCycle,
          triggerType: WorkflowTriggerType.MANUAL,
          triggerConfig: {},
          isActive: false,
        },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // ✅ Aucune persistance n'a eu lieu
    expect(workflowRepo.save).not.toHaveBeenCalled();
    expect(workflowsDb.size).toBe(0);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('nœud de type invalide → rejet avant persistance', async () => {
    await expect(
      flowsService.create(
        { name: 'Workflow Invalide', graph: graphNoeudInvalide,
          triggerType: WorkflowTriggerType.MANUAL, triggerConfig: {}, isActive: false },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(workflowRepo.save).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('boucle auto-référente → rejet par le validateur', async () => {
    await expect(
      flowsService.create(
        { name: 'Workflow Boucle', graph: graphAutoRef,
          triggerType: WorkflowTriggerType.MANUAL, triggerConfig: {}, isActive: false },
        adminUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(workflowRepo.save).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('créer → activer → désactiver : transitions d\'état cohérentes', async () => {
    const wf = await flowsService.create(
      { name: 'Workflow Pompe B', graph: graphValide,
        triggerType: WorkflowTriggerType.MANUAL, triggerConfig: {}, isActive: false },
      adminUser,
    );
    expect(wf.isActive).toBe(false);

    // ✅ Activation : FlowsService.activate() → repo.save avec isActive = true
    const activated = await flowsService.activate(wf.id);
    expect(activated.isActive).toBe(true);

    // ✅ Désactivation
    const deactivated = await flowsService.deactivate(wf.id);
    expect(deactivated.isActive).toBe(false);

    // 3 appels à save : create + activate + deactivate
    expect(workflowRepo.save).toHaveBeenCalledTimes(3);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('findOne sur ID inexistant → NotFoundException propagée', async () => {
    await expect(flowsService.findOne('id-inexistant'))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
