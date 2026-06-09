import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AlertsService } from './alerts.service';
import { Alert, AlertSeverity, AlertStatus, AlertType } from '../database/entities/Alert.entity';
import { Station } from '../database/entities/Station.entity';
import { Sensor } from '../database/entities/Sensor.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationsService } from '../notifications/notifications.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockAlert = (): Alert =>
  ({
    id: 'alert-uuid',
    type: AlertType.THRESHOLD_VIOLATION,
    severity: AlertSeverity.ERROR,
    status: AlertStatus.ACTIVE,
    message: 'High pressure detected',
    createdAt: new Date(),
  } as Alert);

const mockStation = (): Station =>
  ({ id: 'station-uuid', name: 'Station Alpha' } as Station);

const mockAlertRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })) as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
  findOne: jest.fn() as jest.MockedFunction<any>,
  findAndCount: jest.fn() as jest.MockedFunction<any>,
});

const mockStationRepo = () => ({
  findOne: jest.fn() as jest.MockedFunction<any>,
});

const mockSensorRepo = () => ({
  findOne: jest.fn() as jest.MockedFunction<any>,
});

const mockRealtimeService = () => ({
  broadcastToAll: jest.fn(),
});

const mockNotificationsService = () => ({
  notifyAlertCreated: jest.fn() as jest.MockedFunction<any>,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AlertsService', () => {
  let service: AlertsService;
  let alertRepo: ReturnType<typeof mockAlertRepo>;
  let stationRepo: ReturnType<typeof mockStationRepo>;
  let sensorRepo: ReturnType<typeof mockSensorRepo>;
  let realtimeService: ReturnType<typeof mockRealtimeService>;
  let notificationsService: ReturnType<typeof mockNotificationsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getRepositoryToken(Alert), useFactory: mockAlertRepo },
        { provide: getRepositoryToken(Station), useFactory: mockStationRepo },
        { provide: getRepositoryToken(Sensor), useFactory: mockSensorRepo },
        { provide: RealtimeService, useFactory: mockRealtimeService },
        { provide: NotificationsService, useFactory: mockNotificationsService },
      ],
    }).compile();

    service = module.get(AlertsService);
    alertRepo = module.get(getRepositoryToken(Alert));
    stationRepo = module.get(getRepositoryToken(Station));
    sensorRepo = module.get(getRepositoryToken(Sensor));
    realtimeService = module.get(RealtimeService);
    notificationsService = module.get(NotificationsService);

    // Default return values
    alertRepo.save.mockResolvedValue({ id: 'alert-uuid', type: AlertType.THRESHOLD_VIOLATION, severity: AlertSeverity.ERROR, message: 'test', createdAt: new Date() });
    alertRepo.findOne.mockResolvedValue(null);
    alertRepo.findAndCount.mockResolvedValue([[], 0]);
    stationRepo.findOne.mockResolvedValue(null);
    sensorRepo.findOne.mockResolvedValue(null);
    notificationsService.notifyAlertCreated.mockResolvedValue(undefined);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      type: AlertType.THRESHOLD_VIOLATION,
      severity: AlertSeverity.ERROR,
      message: 'High pressure detected',
    };

    it('creates and returns alert without station/sensor', async () => {
      const result = await service.create(dto);
      expect(alertRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('broadcasts real-time event after creation', async () => {
      await service.create(dto);
      expect(realtimeService.broadcastToAll).toHaveBeenCalledWith(
        'alert-created',
        expect.objectContaining({ severity: AlertSeverity.ERROR }),
      );
    });

    it('fires notification without blocking (fire-and-forget)', async () => {
      await service.create(dto);
      // notifyAlertCreated should have been called (fire-and-forget)
      expect(notificationsService.notifyAlertCreated).toHaveBeenCalled();
    });

    it('still creates alert even when notifyAlertCreated rejects', async () => {
      notificationsService.notifyAlertCreated.mockRejectedValue(
        new Error('email down'),
      );
      // Should NOT throw — fire-and-forget catches errors
      await expect(service.create(dto)).resolves.toHaveProperty('id');
    });

    it('throws NotFoundException when stationId is given but station not found', async () => {
      stationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ ...dto, stationId: 'nonexistent' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resolves station and attaches it to alert when stationId is valid', async () => {
      const station = mockStation();
      stationRepo.findOne.mockResolvedValue(station);
      await service.create({ ...dto, stationId: station.id });
      expect(alertRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ station }),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated response', async () => {
      const alerts = [mockAlert(), mockAlert()];
      alertRepo.findAndCount.mockResolvedValue([alerts, 2]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.pages).toBe(1);
    });

    it('returns empty data when no alerts exist', async () => {
      alertRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll({});
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns alert when found', async () => {
      const alert = mockAlert();
      alertRepo.findOne.mockResolvedValue(alert);
      await expect(service.findOne('alert-uuid')).resolves.toEqual(alert);
    });

    it('throws NotFoundException when alert does not exist', async () => {
      alertRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
