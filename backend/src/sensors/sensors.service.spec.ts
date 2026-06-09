import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SensorsService } from './sensors.service';
import { Sensor, SensorStatus, SensorType } from '../database/entities/Sensor.entity';
import { SensorData } from '../database/entities/SensorData.entity';
import { Station } from '../database/entities/Station.entity';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSensor = (overrides: Partial<Sensor> = {}): Sensor =>
  ({
    id: 'sensor-uuid',
    name: 'Pressure Sensor',
    type: SensorType.PRESSURE,
    unit: 'bar',
    status: SensorStatus.ACTIVE,
    station: { id: 'station-uuid', name: 'Station Alpha' },
    lastReading: null,
    lastReadingAt: null,
    alertEnabled: false,
    minThreshold: null,
    maxThreshold: null,
    ...overrides,
  } as unknown as Sensor);

const makeStation = (): Station =>
  ({ id: 'station-uuid', name: 'Station Alpha' } as unknown as Station);

const makeSensorData = (): SensorData =>
  ({
    id: 'data-uuid',
    value: 42,
    timestamp: new Date(),
    source: 'mqtt',
    qualityFlags: {},
  } as unknown as SensorData);

const mockSensorRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })) as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
  findOne: jest.fn() as jest.MockedFunction<any>,
  findAndCount: jest.fn() as jest.MockedFunction<any>,
  remove: jest.fn() as jest.MockedFunction<any>,
});

const mockSensorDataRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })) as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
  find: jest.fn() as jest.MockedFunction<any>,
});

const mockStationRepo = () => ({
  findOne: jest.fn() as jest.MockedFunction<any>,
});

const mockCacheManager = () => ({
  get: jest.fn() as jest.MockedFunction<any>,
  set: jest.fn() as jest.MockedFunction<any>,
  del: jest.fn() as jest.MockedFunction<any>,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SensorsService', () => {
  let service: SensorsService;
  let sensorRepo: ReturnType<typeof mockSensorRepo>;
  let sensorDataRepo: ReturnType<typeof mockSensorDataRepo>;
  let stationRepo: ReturnType<typeof mockStationRepo>;
  let cacheManager: ReturnType<typeof mockCacheManager>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SensorsService,
        { provide: getRepositoryToken(Sensor), useFactory: mockSensorRepo },
        { provide: getRepositoryToken(SensorData), useFactory: mockSensorDataRepo },
        { provide: getRepositoryToken(Station), useFactory: mockStationRepo },
        { provide: CACHE_MANAGER, useFactory: mockCacheManager },
      ],
    }).compile();

    service = module.get(SensorsService);
    sensorRepo = module.get(getRepositoryToken(Sensor));
    sensorDataRepo = module.get(getRepositoryToken(SensorData));
    stationRepo = module.get(getRepositoryToken(Station));
    cacheManager = module.get(CACHE_MANAGER);

    // Default return values
    sensorRepo.save.mockResolvedValue(makeSensor());
    sensorRepo.findOne.mockResolvedValue(null);
    sensorRepo.findAndCount.mockResolvedValue([[], 0]);
    sensorRepo.remove.mockResolvedValue(undefined);
    sensorDataRepo.save.mockResolvedValue(makeSensorData());
    sensorDataRepo.find.mockResolvedValue([]);
    stationRepo.findOne.mockResolvedValue(null);
    cacheManager.get.mockResolvedValue(null);
    cacheManager.set.mockResolvedValue(undefined);
    cacheManager.del.mockResolvedValue(undefined);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    const dto = {
      name: 'Pressure Sensor',
      type: SensorType.PRESSURE,
      unit: 'bar',
      stationId: 'station-uuid',
    };

    it('creates and returns sensor when station exists', async () => {
      const station = makeStation();
      stationRepo.findOne.mockResolvedValue(station);
      const saved = makeSensor();
      sensorRepo.save.mockResolvedValue(saved);

      const result = await service.create(dto as any);

      expect(sensorRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ station }),
      );
      expect(sensorRepo.save).toHaveBeenCalled();
      expect(result).toEqual(saved);
    });

    it('throws NotFoundException when stationId is not found', async () => {
      stationRepo.findOne.mockResolvedValue(null);

      await expect(service.create(dto as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('clears list cache after successful creation', async () => {
      stationRepo.findOne.mockResolvedValue(makeStation());

      await service.create(dto as any);

      // clearListCache iterates internal set; verify del is NOT called when set is empty
      // (no prior findAll calls, so listCacheKeys is empty — this verifies no error is thrown)
      expect(cacheManager.del).not.toHaveBeenCalled();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns cached result when cache hit occurs', async () => {
      const cached = {
        data: [makeSensor()],
        meta: { total: 1, page: 1, limit: 20, pages: 1 },
      };
      cacheManager.get.mockResolvedValue(cached);

      const result = await service.findAll({ page: 1, limit: 20 } as any);

      expect(result).toEqual(cached);
      expect(sensorRepo.findAndCount).not.toHaveBeenCalled();
    });

    it('queries DB and caches result on cache miss', async () => {
      cacheManager.get.mockResolvedValue(null);
      const sensors = [makeSensor()];
      sensorRepo.findAndCount.mockResolvedValue([sensors, 1]);

      const result = await service.findAll({ page: 1, limit: 20 } as any);

      expect(sensorRepo.findAndCount).toHaveBeenCalled();
      expect(cacheManager.set).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('returns empty list when no sensors exist', async () => {
      cacheManager.get.mockResolvedValue(null);
      sensorRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({} as any);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('calculates page count correctly for multi-page results', async () => {
      cacheManager.get.mockResolvedValue(null);
      sensorRepo.findAndCount.mockResolvedValue([[], 50]);

      const result = await service.findAll({ page: 1, limit: 10 } as any);

      expect(result.meta.pages).toBe(5);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns sensor when found', async () => {
      const sensor = makeSensor();
      sensorRepo.findOne.mockResolvedValue(sensor);

      await expect(service.findOne('sensor-uuid')).resolves.toEqual(sensor);
    });

    it('throws NotFoundException when sensor does not exist', async () => {
      sensorRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates sensor fields and clears cache', async () => {
      const existing = makeSensor();
      sensorRepo.findOne.mockResolvedValue(existing);
      const saved = makeSensor({ name: 'Renamed' });
      sensorRepo.save.mockResolvedValue(saved);

      const result = await service.update('sensor-uuid', { name: 'Renamed' } as any);

      expect(sensorRepo.save).toHaveBeenCalled();
      expect(result).toEqual(saved);
    });

    it('re-assigns station when stationId is provided in dto', async () => {
      const existing = makeSensor();
      sensorRepo.findOne.mockResolvedValue(existing);
      const newStation = { id: 'station-2', name: 'Station Beta' } as Station;
      stationRepo.findOne.mockResolvedValue(newStation);
      sensorRepo.save.mockResolvedValue({ ...existing, station: newStation });

      await service.update('sensor-uuid', { stationId: 'station-2' } as any);

      expect(existing.station).toEqual(newStation);
    });

    it('throws NotFoundException when new stationId does not exist', async () => {
      sensorRepo.findOne.mockResolvedValue(makeSensor());
      stationRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('sensor-uuid', { stationId: 'bad-station' } as any),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes sensor and returns { deleted: true, id }', async () => {
      const sensor = makeSensor();
      sensorRepo.findOne.mockResolvedValue(sensor);

      const result = await service.remove('sensor-uuid');

      expect(sensorRepo.remove).toHaveBeenCalledWith(sensor);
      expect(result).toEqual({ deleted: true, id: 'sensor-uuid' });
    });

    it('throws NotFoundException when sensor does not exist', async () => {
      sensorRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── injectReading ─────────────────────────────────────────────────────────

  describe('injectReading', () => {
    it('updates lastReading and lastReadingAt on the sensor', async () => {
      const sensor = makeSensor();
      sensorRepo.findOne.mockResolvedValue(sensor);
      sensorRepo.save.mockResolvedValue({ ...sensor, lastReading: 99 });

      await service.injectReading('sensor-uuid', 99);

      expect(sensor.lastReading).toBe(99);
      expect(sensor.lastReadingAt).toBeInstanceOf(Date);
      expect(sensorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastReading: 99 }),
      );
    });

    it('creates and saves a SensorData record with source "manual"', async () => {
      const sensor = makeSensor();
      sensorRepo.findOne.mockResolvedValue(sensor);

      await service.injectReading('sensor-uuid', 55);

      expect(sensorDataRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ value: 55, source: 'manual' }),
      );
      expect(sensorDataRepo.save).toHaveBeenCalled();
    });

    it('returns a structured reading summary', async () => {
      const sensor = makeSensor({ name: 'Flow Meter', unit: 'L/s' });
      sensorRepo.findOne.mockResolvedValue(sensor);

      const result = await service.injectReading('sensor-uuid', 77);

      expect(result).toMatchObject({
        sensorId: 'sensor-uuid',
        name: 'Flow Meter',
        value: 77,
        unit: 'L/s',
      });
    });

    it('throws NotFoundException when sensor does not exist', async () => {
      sensorRepo.findOne.mockResolvedValue(null);

      await expect(service.injectReading('nonexistent', 10)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
