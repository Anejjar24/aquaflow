import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import {
  Notification,
  NotificationStatus,
} from '../database/entities/Notification.entity';
import { User, UserRole } from '../database/entities/User.entity';
import {
  Alert,
  AlertSeverity,
  AlertStatus,
  AlertType,
} from '../database/entities/Alert.entity';
import { RealtimeService } from '../realtime/realtime.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeNotification = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: 'notif-uuid',
    recipient: 'all',
    status: NotificationStatus.DELIVERED,
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as Notification);

const makeAlert = (): Alert =>
  ({
    id: 'alert-uuid',
    type: AlertType.THRESHOLD_VIOLATION,
    severity: AlertSeverity.ERROR,
    status: AlertStatus.ACTIVE,
    message: 'Pressure too high',
    createdAt: new Date(),
  } as Alert);

// ─── Mock factories ───────────────────────────────────────────────────────────

const mockNotificationRepo = () => ({
  create: jest.fn((dto: any) => dto),
  save: jest.fn(async (entity: any) => ({ id: 'notif-uuid', ...entity })),
  findOne: jest.fn() as jest.MockedFunction<any>,
  createQueryBuilder: jest.fn() as jest.MockedFunction<any>,
});

const mockUserRepo = () => ({
  find: jest.fn(async () => [] as User[]),
});

const mockRealtimeService = () => ({
  broadcastToAll: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((_key: string) => undefined as string | undefined),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifRepo: ReturnType<typeof mockNotificationRepo>;
  let realtimeService: ReturnType<typeof mockRealtimeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useFactory: mockNotificationRepo,
        },
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: RealtimeService, useFactory: mockRealtimeService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get(NotificationsService);
    notifRepo = module.get(getRepositoryToken(Notification));
    realtimeService = module.get(RealtimeService);
  });

  // ── notifyAlertCreated ────────────────────────────────────────────────────

  describe('notifyAlertCreated', () => {
    it('saves a broadcast notification record', async () => {
      await service.notifyAlertCreated(makeAlert());
      expect(notifRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ recipient: 'all' }),
      );
    });

    it('broadcasts notification-created via WebSocket', async () => {
      await service.notifyAlertCreated(makeAlert());
      expect(realtimeService.broadcastToAll).toHaveBeenCalledWith(
        'notification-created',
        expect.objectContaining({ alertId: 'alert-uuid' }),
      );
    });

    it('skips email when SMTP_HOST is not configured', async () => {
      // SMTP_HOST returns undefined → should skip email silently
      await expect(
        service.notifyAlertCreated({
          ...makeAlert(),
          severity: AlertSeverity.CRITICAL,
        } as Alert),
      ).resolves.toBeUndefined();
    });
  });

  // ── getUnreadCount ────────────────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('returns a count object with a number', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn(async () => 3),
      };
      notifRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getUnreadCount();
      expect(result).toEqual({ count: 3 });
    });
  });

  // ── markRead ──────────────────────────────────────────────────────────────

  describe('markRead', () => {
    it('throws NotFoundException when notification not found', async () => {
      notifRepo.findOne.mockResolvedValue(null);
      await expect(service.markRead('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('sets readAt and status = READ, then saves', async () => {
      const notif = makeNotification();
      notifRepo.findOne.mockResolvedValue(notif);
      notifRepo.save.mockResolvedValue({
        ...notif,
        status: NotificationStatus.READ,
        readAt: new Date(),
      });

      const result = await service.markRead('notif-uuid');

      expect(notifRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: NotificationStatus.READ }),
      );
      expect(result.readAt).not.toBeNull();
    });
  });

  // ── markAllRead ───────────────────────────────────────────────────────────

  describe('markAllRead', () => {
    const makeUpdateQb = (affected: number): any => ({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn(async () => ({ affected })),
    });

    it('broadcasts notifications-read-all event', async () => {
      notifRepo.createQueryBuilder.mockReturnValue(makeUpdateQb(5));
      await service.markAllRead();
      expect(realtimeService.broadcastToAll).toHaveBeenCalledWith(
        'notifications-read-all',
        { count: 0 },
      );
    });

    it('returns count of updated rows', async () => {
      notifRepo.createQueryBuilder.mockReturnValue(makeUpdateQb(4));
      const result = await service.markAllRead();
      expect(result).toEqual({ updated: 4 });
    });
  });
});
