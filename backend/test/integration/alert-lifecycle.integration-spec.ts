/**
 * TEST D'INTÉGRATION #4 — Cycle de vie complet d'une alerte
 *
 * Ce test vérifie que AlertsService et NotificationsService
 * gèrent correctement les transitions d'état :
 *   ACTIVE → ACKNOWLEDGED → RESOLVED
 *
 * Composants RÉELS :
 *   ✅ AlertsService         — create / acknowledge / resolve / exportCsv
 *   ✅ NotificationsService  — notifyAlertCreated (notification in-app)
 *
 * Composants mockés :
 *   🔧 Repositories        — DB en mémoire
 *   🔧 RealtimeService     — pas de vrai WebSocket
 *   🔧 ConfigService       — pas de SMTP
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from '../../src/alerts/alerts.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { RealtimeService } from '../../src/realtime/realtime.service';
import { Alert, AlertSeverity, AlertStatus, AlertType } from '../../src/database/entities/Alert.entity';
import { Station } from '../../src/database/entities/Station.entity';
import { Sensor } from '../../src/database/entities/Sensor.entity';
import { Notification, NotificationChannel, NotificationStatus, NotificationType } from '../../src/database/entities/Notification.entity';
import { User, UserRole } from '../../src/database/entities/User.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

const operateur = {
  id: 'user-op-01', email: 'op@aquaflow.io',
  firstname: 'Opérateur', lastname: 'Test', role: UserRole.OPERATOR,
} as User;

const technicien = {
  id: 'user-tech-01', email: 'tech@aquaflow.io',
  firstname: 'Technicien', lastname: 'Test', role: UserRole.TECHNICIAN,
} as User;

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('[Intégration] AlertsService + NotificationsService — Cycle de vie alerte', () => {
  let module: TestingModule;
  let alertsService: AlertsService;
  let notificationsService: NotificationsService;

  // DB en mémoire
  let alertIdCounter = 0;
  let notifIdCounter = 0;
  const alertsDb: Map<string, Alert> = new Map();
  const notifsDb: Map<string, Notification> = new Map();

  const alertRepo = {
    create: jest.fn((d: any) => ({
      ...d, id: `alert-${++alertIdCounter}`, createdAt: new Date(), status: AlertStatus.ACTIVE,
    } as Alert)),
    save: jest.fn(async (a: any) => { alertsDb.set(a.id, a); return a; }),
    findOne: jest.fn(async ({ where }: any) => alertsDb.get(where.id) ?? null),
    findAndCount: jest.fn(async () => [Array.from(alertsDb.values()), alertsDb.size] as any),
    find: jest.fn(async () => Array.from(alertsDb.values())),
  };

  const stationRepo = { findOne: jest.fn(async () => null) };
  const sensorRepo  = { findOne: jest.fn(async () => null) };

  const notifRepo = {
    create: jest.fn((d: any) => ({
      ...d, id: `notif-${++notifIdCounter}`, createdAt: new Date(),
    } as Notification)),
    save: jest.fn(async (n: any) => { notifsDb.set(n.id, n); return n; }),
    find: jest.fn(async () => Array.from(notifsDb.values())),
    findOne: jest.fn(async () => null),
    findAndCount: jest.fn(async () => [Array.from(notifsDb.values()), notifsDb.size] as any),
  };

  const userRepo      = { find: jest.fn(async () => [operateur, technicien]) };
  const realtimeService = { broadcastToAll: jest.fn() };
  const configService   = { get: jest.fn(() => null) }; // pas de SMTP

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        // ✅ Services RÉELS
        AlertsService,
        NotificationsService,

        { provide: getRepositoryToken(Alert),        useValue: alertRepo },
        { provide: getRepositoryToken(Station),      useValue: stationRepo },
        { provide: getRepositoryToken(Sensor),       useValue: sensorRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(User),         useValue: userRepo },
        { provide: RealtimeService,                  useValue: realtimeService },
        { provide: ConfigService,                    useValue: configService },
      ],
    }).compile();

    module.useLogger(false);

    alertsService        = module.get(AlertsService);
    notificationsService = module.get(NotificationsService);
  });

  afterAll(() => module.close());

  beforeEach(() => {
    alertIdCounter = 0;
    notifIdCounter = 0;
    alertsDb.clear();
    notifsDb.clear();
    jest.clearAllMocks();
    // Réinitialiser les mocks
    alertRepo.create.mockImplementation((d: any) => ({
      ...d, id: `alert-${++alertIdCounter}`, createdAt: new Date(), status: AlertStatus.ACTIVE,
    } as Alert));
    alertRepo.save.mockImplementation(async (a: any) => { alertsDb.set(a.id, a); return a; });
    alertRepo.findOne.mockImplementation(async ({ where }: any) => alertsDb.get(where.id) ?? null);
    alertRepo.findAndCount.mockImplementation(async () => [Array.from(alertsDb.values()), alertsDb.size] as any);
    alertRepo.find.mockImplementation(async () => Array.from(alertsDb.values()));
    notifRepo.create.mockImplementation((d: any) => ({
      ...d, id: `notif-${++notifIdCounter}`, createdAt: new Date(),
    } as Notification));
    notifRepo.save.mockImplementation(async (n: any) => { notifsDb.set(n.id, n); return n; });
    notifRepo.find.mockImplementation(async () => Array.from(notifsDb.values()));
    notifRepo.findAndCount.mockImplementation(async () => [Array.from(notifsDb.values()), notifsDb.size] as any);
    userRepo.find.mockResolvedValue([operateur, technicien]);
    realtimeService.broadcastToAll.mockClear();
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('create → alerte ACTIVE + notification in-app créée + WebSocket émis', async () => {
    const alerte = await alertsService.create({
      type: AlertType.THRESHOLD_VIOLATION,
      severity: AlertSeverity.ERROR,
      message: 'Pression dépassée : 7.5 bar (seuil : 5 bar)',
    });

    // ✅ Alerte persistée avec statut ACTIVE
    expect(alerte.id).toBeDefined();
    expect(alerte.status).toBe(AlertStatus.ACTIVE);
    expect(alertsDb.size).toBe(1);

    // ✅ AlertsService → NotificationsService : notification créée (fire-and-forget)
    await new Promise(r => setTimeout(r, 50));
    expect(notifsDb.size).toBe(1);
    const notif = Array.from(notifsDb.values())[0];
    expect(notif.type).toBe(NotificationType.ALERT);
    expect(notif.channel).toBe(NotificationChannel.IN_APP);
    expect(notif.status).toBe(NotificationStatus.DELIVERED);
    expect(notif.subject).toContain('ERROR');

    // ✅ WebSocket broadcast émis par AlertsService
    expect(realtimeService.broadcastToAll).toHaveBeenCalledWith(
      'alert-created',
      expect.objectContaining({ severity: AlertSeverity.ERROR }),
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('ACTIVE → ACKNOWLEDGED : statut mis à jour + auteur enregistré', async () => {
    const alerte = await alertsService.create({
      type: AlertType.SENSOR_OFFLINE,
      severity: AlertSeverity.WARNING,
      message: 'Capteur hors ligne depuis 10 minutes',
    });

    expect(alerte.status).toBe(AlertStatus.ACTIVE);

    // ✅ Acquittement par l'opérateur
    const alerteAck = await alertsService.acknowledge(alerte.id, operateur);

    expect(alerteAck.status).toBe(AlertStatus.ACKNOWLEDGED);
    expect(alerteAck.acknowledgedAt).toBeInstanceOf(Date);
    expect(alerteAck.acknowledgedBy.id).toBe(operateur.id);

    // Mise à jour persistée en DB
    expect(alertsDb.get(alerte.id)!.status).toBe(AlertStatus.ACKNOWLEDGED);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('ACTIVE → ACKNOWLEDGED → RESOLVED : cycle de vie complet', async () => {
    const alerte = await alertsService.create({
      type: AlertType.MAINTENANCE_DUE,
      severity: AlertSeverity.WARNING,
      message: 'Maintenance préventive requise',
    });

    // Étape 1 : acquittement par l'opérateur
    await alertsService.acknowledge(alerte.id, operateur);
    expect(alertsDb.get(alerte.id)!.status).toBe(AlertStatus.ACKNOWLEDGED);

    // Étape 2 : résolution par le technicien
    const alerteResolue = await alertsService.resolve(alerte.id, technicien);

    expect(alerteResolue.status).toBe(AlertStatus.RESOLVED);
    expect(alerteResolue.resolvedAt).toBeInstanceOf(Date);
    expect(alerteResolue.resolvedBy.id).toBe(technicien.id);

    // 3 appels à save : create + acknowledge + resolve
    expect(alertRepo.save).toHaveBeenCalledTimes(3);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('exportCsv → CSV avec en-têtes corrects et données réelles', async () => {
    // Créer 2 alertes
    await alertsService.create({
      type: AlertType.THRESHOLD_VIOLATION, severity: AlertSeverity.ERROR,
      message: 'Alerte pression 1',
    });
    await alertsService.create({
      type: AlertType.SENSOR_OFFLINE, severity: AlertSeverity.WARNING,
      message: 'Capteur hors ligne',
    });

    const csv = await alertsService.exportCsv({});

    // ✅ En-têtes CSV présents
    expect(csv).toContain('id,type,severity,status,message');
    // ✅ Données des deux alertes présentes
    expect(csv).toContain('threshold_violation');
    expect(csv).toContain('sensor_offline');
    expect(csv).toContain('Alerte pression 1');
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('findOne sur alerte inexistante → NotFoundException', async () => {
    await expect(alertsService.findOne('id-inexistant'))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('échec notification ne bloque pas la création de l\'alerte', async () => {
    // Simuler une erreur dans notifRepo.save
    notifRepo.save.mockRejectedValueOnce(new Error('DB notification down'));

    // ✅ L'alerte doit quand même être créée
    const alerte = await alertsService.create({
      type: AlertType.SYSTEM_ERROR, severity: AlertSeverity.CRITICAL,
      message: 'Erreur système critique',
    });

    expect(alerte.id).toBeDefined();
    expect(alertsDb.size).toBe(1);
  });
});
