import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StationsService } from './stations.service';
import { Station, StationStatus, StationType } from '../database/entities/Station.entity';
import { User } from '../database/entities/User.entity';
import { RealtimeService } from '../realtime/realtime.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeStation = (overrides: Partial<Station> = {}): Station =>
  ({
    id: 'station-uuid',
    name: 'Station Alpha',
    status: StationStatus.NORMAL,
    type: StationType.DISTRIBUTION,
    lastStatusChange: null as unknown as Date,
    createdBy: null,
    ...overrides,
  } as unknown as Station);

const makeUser = (): User => ({ id: 'user-uuid', name: 'Admin' } as unknown as User);

const mockStationRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })) as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
  findOne: jest.fn() as jest.MockedFunction<any>,
  findAndCount: jest.fn() as jest.MockedFunction<any>,
  remove: jest.fn() as jest.MockedFunction<any>,
});

const mockRealtimeService = () => ({
  broadcastToAll: jest.fn(),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StationsService', () => {
  let service: StationsService;
  let stationRepo: ReturnType<typeof mockStationRepo>;
  let realtimeService: ReturnType<typeof mockRealtimeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StationsService,
        { provide: getRepositoryToken(Station), useFactory: mockStationRepo },
        { provide: RealtimeService, useFactory: mockRealtimeService },
      ],
    }).compile();

    service = module.get(StationsService);
    stationRepo = module.get(getRepositoryToken(Station));
    realtimeService = module.get(RealtimeService);

    // Default return values
    stationRepo.save.mockResolvedValue(makeStation());
    stationRepo.findOne.mockResolvedValue(null);
    stationRepo.findAndCount.mockResolvedValue([[], 0]);
    stationRepo.remove.mockResolvedValue(undefined);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = { name: 'New Station', type: 'pumping', status: 'active' };

    it('creates and saves a station, then returns it', async () => {
      const saved = makeStation({ name: 'New Station' });
      stationRepo.save.mockResolvedValue(saved);

      const result = await service.create(dto as any, makeUser());

      expect(stationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Station' }),
      );
      expect(stationRepo.save).toHaveBeenCalled();
      expect(result).toEqual(saved);
    });

    it('sets lastStatusChange when status is provided', async () => {
      await service.create({ name: 'S', type: 'pumping', status: 'active' } as any, makeUser());

      expect(stationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ lastStatusChange: expect.any(Date) }),
      );
    });

    it('does NOT set lastStatusChange when status is absent', async () => {
      await service.create({ name: 'S', type: 'pumping' } as any, makeUser());

      const callArg = stationRepo.create.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('lastStatusChange');
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns paginated response with correct meta', async () => {
      const stations = [makeStation(), makeStation({ id: 'station-2' })];
      stationRepo.findAndCount.mockResolvedValue([stations, 2]);

      const result = await service.findAll({ page: 1, limit: 10 } as any);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.pages).toBe(1);
    });

    it('returns empty data when no stations exist', async () => {
      stationRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll({} as any);
      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('uses default page=1 and limit=20 when not provided', async () => {
      stationRepo.findAndCount.mockResolvedValue([[], 0]);
      await service.findAll({} as any);

      expect(stationRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns station when found', async () => {
      const station = makeStation();
      stationRepo.findOne.mockResolvedValue(station);

      await expect(service.findOne('station-uuid')).resolves.toEqual(station);
    });

    it('throws NotFoundException when station does not exist', async () => {
      stationRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('saves and returns updated station', async () => {
      const existing = makeStation({ status: StationStatus.NORMAL });
      const updated = makeStation({ status: StationStatus.OFFLINE });

      stationRepo.findOne.mockResolvedValue(existing);
      stationRepo.save.mockResolvedValue(updated);

      const result = await service.update('station-uuid', { status: StationStatus.OFFLINE } as any);

      expect(stationRepo.save).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });

    it('sets lastStatusChange when status actually changes', async () => {
      const existing = makeStation({ status: StationStatus.NORMAL });
      stationRepo.findOne.mockResolvedValue(existing);
      stationRepo.save.mockResolvedValue({ ...existing, status: StationStatus.OFFLINE });

      await service.update('station-uuid', { status: StationStatus.OFFLINE } as any);

      expect(existing.lastStatusChange).toBeInstanceOf(Date);
    });

    it('does NOT update lastStatusChange when status stays the same', async () => {
      const existing = makeStation({ status: StationStatus.NORMAL, lastStatusChange: null as unknown as Date });
      stationRepo.findOne.mockResolvedValue(existing);
      stationRepo.save.mockResolvedValue(existing);

      await service.update('station-uuid', { status: StationStatus.NORMAL } as any);

      expect(existing.lastStatusChange).toBeNull();
    });

    it('broadcasts station-status event when dto contains a status field', async () => {
      const saved = makeStation({ status: StationStatus.OFFLINE });
      stationRepo.findOne.mockResolvedValue(makeStation({ status: StationStatus.NORMAL }));
      stationRepo.save.mockResolvedValue(saved);

      await service.update('station-uuid', { status: StationStatus.OFFLINE } as any);

      expect(realtimeService.broadcastToAll).toHaveBeenCalledWith(
        'station-status',
        expect.objectContaining({ stationId: saved.id, status: StationStatus.OFFLINE }),
      );
    });

    it('does NOT broadcast when dto has no status field', async () => {
      const existing = makeStation();
      stationRepo.findOne.mockResolvedValue(existing);
      stationRepo.save.mockResolvedValue(existing);

      await service.update('station-uuid', { name: 'Renamed' } as any);

      expect(realtimeService.broadcastToAll).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when station is not found', async () => {
      stationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'X' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes station and returns { deleted: true, id }', async () => {
      const station = makeStation();
      stationRepo.findOne.mockResolvedValue(station);

      const result = await service.remove('station-uuid');

      expect(stationRepo.remove).toHaveBeenCalledWith(station);
      expect(result).toEqual({ deleted: true, id: 'station-uuid' });
    });

    it('throws NotFoundException when station does not exist', async () => {
      stationRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
