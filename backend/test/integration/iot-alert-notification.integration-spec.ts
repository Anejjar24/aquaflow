/**
 * TEST D'INTÉGRATION #1 — Chaîne IoT → Alerte → Notification
 *
 * Ce test vérifie que trois services réels collaborent correctement :
 *   IotService → AlertsService → NotificationsService
 *
 * Composants RÉELS (pas de mocks) :
 *   ✅ IotService          — traitement des données capteurs
 *   ✅ AlertsService       — création et gestion des alertes
 *   ✅ NotificationsService — création des notifications in-app
 *
 * Composants mockés (infrastructure externe uniquement) :
 *   🔧 Repositories TypeORM  — pas de vraie DB nécessaire
 *   🔧 RealtimeService        — pas de vrai WebSocket
 *   🔧 KafkaProducerService   — pas de vrai Kafka
 *   🔧 ConfigService          — pas de SMTP
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { IotService } from '../../src/iot/iot.service';
import { AlertsService } from '../../src/alerts/alerts.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { RealtimeService } from '../../src/realtime/realtime.service';
import { KafkaProducerService } from '../../src/iot/kafka/kafka.producer.service';
import { Sensor, SensorStatus, SensorType } from '../../src/database/entities/Sensor.entity';
import { SensorData } from '../../src/database/entities/SensorData.entity';
import { Alert, AlertSeverity, AlertStatus, AlertType } from '../../src/database/entities/Alert.entity';
import { Station } from '../../src/database/entities/Station.entity';
import { Notification, NotificationChannel, NotificationStatus, NotificationType } from '../../src/database/entities/Notification.entity';
import { User } from '../../src/database/entities/User.entity';

// ─── Helpers ────────────────────────────────────────────────────────────────

const stationAlpha = { id: 'station-01', name: 'Station Alpha' };

const makeSensor = (overrides: Partial<any> = {}) => ({
  id: 'sensor-pression-01',
  name: 'Capteur Pression Station Alpha',
  type: SensorType.PRESSURE,
  unit: 'bar',
  status: SensorStatus.ACTIVE,
  alertEnabled: true,
  minThreshold: 1.0,
  maxThreshold: 5.0,
  lastReading: 3.0,
  lastReadingAt: new Date(),
  station: stationAlpha,
  ...overrides,
  get isThresholdViolated() {
    if (this.maxThreshold != null && this.lastReading > this.maxThreshold) return true;
    if (this.minThreshold != null && this.lastReading < this.minThreshold) return true;
    return false;
  },
});

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('[Intégration] IotService → AlertsService → NotificationsService', () => {
  let module: TestingModule;
  let iotService: IotService;
  let alertsService: AlertsService;
  let notificationsService: NotificationsService;

  // Repos mockés — simulent la couche base de données
  const sensorRepo      = { findOne: jest.fn(), save: jest.fn(async (s: any) => s) };
  const sensorDataRepo  = { create: jest.fn((d: any) => d), save: jest.fn(async (d: any) => ({ ...d, id: 'sdata-uuid' })) };
  const alertRepo       = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ ...d, id: 'alert-uuid', createdAt: new Date(), status: AlertStatus.ACTIVE })),
    findOne: jest.fn(async () => null),
    findAndCount: jest.fn(async () => [[], 0]),
  };
  // stationRepo retourne la station pour que AlertsService ne lève pas NotFoundException
  const stationRepo     = { findOne: jest.fn(async () => stationAlpha) };
  const notifRepo       = {
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ ...d, id: 'notif-uuid', createdAt: new Date() })),
    find: jest.fn(async () => []),
    findAndCount: jest.fn(async () => [[], 0]),
    findOne: jest.fn(async () => null),
  };
  const userRepo        = { find: jest.fn(async () => []), findOne: jest.fn(async () => null) };

  // Services d'infrastructure mockés (IO externe)
  const realtimeService = { broadcastToAll: jest.fn() };
  const kafkaProducer   = { publishSensorReading: jest.fn(async () => {}) };
  const configService   = { get: jest.fn((k: string) => k === 'SMTP_HOST' ? null : '') };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        // ✅ Services RÉELS — intégration testée
        IotService,
        AlertsService,
        NotificationsService,

        // Repos (couche DB mockée)
        { provide: getRepositoryToken(Sensor),       useValue: sensorRepo },
        { provide: getRepositoryToken(SensorData),   useValue: sensorDataRepo },
        { provide: getRepositoryToken(Alert),        useValue: alertRepo },
        { provide: getRepositoryToken(Station),      useValue: stationRepo },
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(User),         useValue: userRepo },

        // Infrastructure externe mockée
        { provide: RealtimeService,      useValue: realtimeService },
        { provide: KafkaProducerService, useValue: kafkaProducer },
        { provide: ConfigService,        useValue: configService },
      ],
    }).compile();

    // Désactiver les logs NestJS — évite le bruit rouge dans la console
    module.useLogger(false);

    iotService            = module.get(IotService);
    alertsService         = module.get(AlertsService);
    notificationsService  = module.get(NotificationsService);
  });

  afterAll(() => module.close());

  beforeEach(() => {
    jest.clearAllMocks();
    sensorRepo.findOne.mockResolvedValue(makeSensor());
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('lecture normale (3.2 bar < seuil 5 bar) → aucune alerte créée', async () => {
    sensorRepo.findOne.mockResolvedValue(makeSensor({ lastReading: 3.2 }));

    await iotService.processSensorData('sensor-pression-01', 3.2);

    // La lecture est sauvegardée
    expect(sensorDataRepo.save).toHaveBeenCalledTimes(1);
    // Aucune alerte persistée
    expect(alertRepo.save).not.toHaveBeenCalled();
    // Aucune notification créée
    expect(notifRepo.save).not.toHaveBeenCalled();
    // Le WebSocket reçoit la mise à jour sans flag de violation
    expect(realtimeService.broadcastToAll).toHaveBeenCalledWith(
      'sensor-update',
      expect.objectContaining({ value: 3.2, thresholdViolated: false }),
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('dépassement de seuil (7.5 bar > 5 bar) → alerte créée + notification déclenchée', async () => {
    const capteurViolation = makeSensor({ lastReading: 7.5 });
    // Force isThresholdViolated = true
    Object.defineProperty(capteurViolation, 'isThresholdViolated', { get: () => true });
    sensorRepo.findOne.mockResolvedValue(capteurViolation);

    await iotService.processSensorData('sensor-pression-01', 7.5);

    // ✅ IotService → AlertsService : alerte créée en base
    // IotService utilise WARNING par défaut pour les violations de seuil
    expect(alertRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AlertType.THRESHOLD_VIOLATION,
        severity: AlertSeverity.WARNING,
      }),
    );

    // ✅ AlertsService → NotificationsService : notification in-app créée
    // (appel fire-and-forget, on attend la résolution)
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(notifRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.ALERT,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.DELIVERED,
      }),
    );

    // ✅ WebSocket : broadcasts émis (sensor-update + alert-created)
    expect(realtimeService.broadcastToAll).toHaveBeenCalledWith(
      'alert-created',
      expect.objectContaining({ severity: AlertSeverity.WARNING }),
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('Kafka publie la lecture même si la communication échoue (fire-and-forget)', async () => {
    kafkaProducer.publishSensorReading.mockRejectedValueOnce(new Error('Kafka unreachable'));
    sensorRepo.findOne.mockResolvedValue(makeSensor({ lastReading: 3.0 }));

    // Ne doit pas lever d'exception malgré l'échec Kafka
    await expect(iotService.processSensorData('sensor-pression-01', 3.0)).resolves.not.toThrow();

    // La lecture est quand même sauvegardée en base
    expect(sensorDataRepo.save).toHaveBeenCalledTimes(1);
  });

  // ────────────────────────────────────────────────────────────────────────────
  it('capteur introuvable → aucun traitement effectué', async () => {
    sensorRepo.findOne.mockResolvedValue(null);

    await iotService.processSensorData('capteur-inconnu', 9.9);

    expect(sensorDataRepo.save).not.toHaveBeenCalled();
    expect(alertRepo.save).not.toHaveBeenCalled();
    expect(realtimeService.broadcastToAll).not.toHaveBeenCalled();
  });
});
