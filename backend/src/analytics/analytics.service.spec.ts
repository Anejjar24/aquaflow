import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { Alert, AlertStatus } from '../database/entities/Alert.entity';
import { Maintenance, MaintenanceStatus } from '../database/entities/Maintenance.entity';
import { Sensor, SensorStatus } from '../database/entities/Sensor.entity';
import { SensorAggregate } from '../database/entities/SensorAggregate.entity';
import { SensorData } from '../database/entities/SensorData.entity';
import { Station } from '../database/entities/Station.entity';
import { HistoryGranularity } from './dto/analytics-query.dto';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockStationRepo = () => ({
  count: jest.fn().mockResolvedValue(3),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  }),
});

const mockSensorRepo = () => ({
  count: jest.fn().mockResolvedValue(5),
  findOne: jest.fn(),
});

const mockAlertRepo = () => ({
  count: jest.fn().mockResolvedValue(2),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
  }),
});

const mockMaintenanceRepo = () => ({
  createQueryBuilder: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(1),
  }),
});

const mockDataSource = () => ({
  query: jest.fn(),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let stationRepo: ReturnType<typeof mockStationRepo>;
  let sensorRepo: ReturnType<typeof mockSensorRepo>;
  let alertRepo: ReturnType<typeof mockAlertRepo>;
  let maintenanceRepo: ReturnType<typeof mockMaintenanceRepo>;
  let dataSource: ReturnType<typeof mockDataSource>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: getDataSourceToken(), useFactory: mockDataSource },
        { provide: getRepositoryToken(Station),          useFactory: mockStationRepo },
        { provide: getRepositoryToken(Sensor),           useFactory: mockSensorRepo },
        { provide: getRepositoryToken(Alert),            useFactory: mockAlertRepo },
        { provide: getRepositoryToken(Maintenance),      useFactory: mockMaintenanceRepo },
        { provide: getRepositoryToken(SensorData),       useValue: {} },
        { provide: getRepositoryToken(SensorAggregate),  useValue: {} },
      ],
    }).compile();

    service        = module.get(AnalyticsService);
    stationRepo    = module.get(getRepositoryToken(Station));
    sensorRepo     = module.get(getRepositoryToken(Sensor));
    alertRepo      = module.get(getRepositoryToken(Alert));
    maintenanceRepo= module.get(getRepositoryToken(Maintenance));
    dataSource     = module.get(getDataSourceToken());
  });

  // ── getOverview ──────────────────────────────────────────────────────────────

  describe('getOverview', () => {
    it('returns counts from all repositories', async () => {
      const result = await service.getOverview();
      expect(result.totalStations).toBe(3);
      expect(result.activeSensors).toBe(5);
      expect(result.openAlerts).toBe(2);
      expect(result.maintenancePending).toBe(1);
    });

    it('queries sensors with ACTIVE status filter', async () => {
      await service.getOverview();
      expect(sensorRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: SensorStatus.ACTIVE } }),
      );
    });

    it('queries alerts with ACTIVE status filter', async () => {
      await service.getOverview();
      expect(alertRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: AlertStatus.ACTIVE } }),
      );
    });

    it('returns stationsByStatus array from query builder result', async () => {
      stationRepo.createQueryBuilder().getRawMany.mockResolvedValue([
        { status: 'ONLINE', count: '2' },
        { status: 'OFFLINE', count: '1' },
      ]);
      const result = await service.getOverview();
      expect(result.stationsByStatus).toEqual(
        expect.arrayContaining([{ status: 'ONLINE', count: 2 }]),
      );
    });

    it('returns numeric counts (not strings) in stationsByStatus', async () => {
      stationRepo.createQueryBuilder().getRawMany.mockResolvedValue([
        { status: 'ONLINE', count: '5' },
      ]);
      const result = await service.getOverview();
      expect(typeof result.stationsByStatus[0].count).toBe('number');
    });
  });

  // ── getSensorStats ────────────────────────────────────────────────────────

  describe('getSensorStats', () => {
    const baseSensor: Partial<Sensor> = {
      id: 'sensor-1',
      name: 'Pressure',
      unit: 'bar',
      type: 'pressure' as any,
      status: SensorStatus.ACTIVE,
      minThreshold: 0,
      maxThreshold: 100,
      station: { id: 'st-1', name: 'Station A' } as any,
    };

    beforeEach(() => {
      sensorRepo.findOne.mockResolvedValue(baseSensor);
      // dataSource.query is called multiple times: stats row + time-series
      dataSource.query.mockResolvedValue([]);
    });

    it('returns null when sensor is not found', async () => {
      sensorRepo.findOne.mockResolvedValue(null);
      const result = await service.getSensorStats('nonexistent', {});
      expect(result).toBeNull();
    });

    it('returns sensor metadata in response', async () => {
      dataSource.query.mockResolvedValue([{ avg: '42', min: '10', max: '80', count: '5', stddev: '3' }]);
      const result = await service.getSensorStats('sensor-1', {});
      expect(result?.sensor.id).toBe('sensor-1');
      expect(result?.sensor.name).toBe('Pressure');
    });

    it('rounds stats to 4 decimal places', async () => {
      dataSource.query.mockResolvedValue([{ avg: '42.12346', min: '10', max: '80', count: '5', stddev: '3' }]);
      const result = await service.getSensorStats('sensor-1', {});
      expect(result?.stats.avg).toBe(42.1235);
    });

    it('returns zero count when no data exists', async () => {
      dataSource.query.mockResolvedValue([{ avg: null, min: null, max: null, count: '0', stddev: null }]);
      const result = await service.getSensorStats('sensor-1', {});
      expect(result?.stats.count).toBe(0);
    });

    it('falls back to time_bucket query when hourly view throws', async () => {
      sensorRepo.findOne.mockResolvedValue(baseSensor);
      // First call (stats row): returns empty. Subsequent calls may throw then fall back.
      dataSource.query
        .mockResolvedValueOnce([{ avg: '1', min: '1', max: '1', count: '1', stddev: '0' }])
        .mockRejectedValueOnce(new Error('view not found'))
        .mockResolvedValue([]);

      await expect(
        service.getSensorStats('sensor-1', { granularity: HistoryGranularity.HOUR }),
      ).resolves.toBeTruthy();
    });
  });

  // ── getSystemMetrics ────────────────────────────────────────────────────────

  describe('getSystemMetrics', () => {
    it('returns empty metrics when continuous aggregate is unavailable', async () => {
      dataSource.query.mockRejectedValue(new Error('relation does not exist'));
      const result = await service.getSystemMetrics(24);
      expect(result.totalReadings).toBe(0);
      expect(result.topSensors).toEqual([]);
    });

    it('returns parsed metrics when continuous aggregate is available', async () => {
      dataSource.query
        .mockResolvedValueOnce([{ sensor_id: 's1', total_readings: '100', avg_value: '55.5' }])
        .mockResolvedValueOnce([{ total: '200' }]);

      const result = await service.getSystemMetrics(24);
      expect(result.totalReadings).toBe(200);
      expect(result.topSensors[0].sensorId).toBe('s1');
      expect(result.topSensors[0].totalReadings).toBe(100);
    });

    it('defaults to 24-hour window', async () => {
      dataSource.query.mockRejectedValue(new Error('no view'));
      const result = await service.getSystemMetrics();
      expect(result.windowHours).toBe(24);
    });
  });

  // ── getKpis ───────────────────────────────────────────────────────────────

  describe('getKpis', () => {
    it('returns empty KPIs when sensor_aggregates table is not populated', async () => {
      dataSource.query.mockRejectedValue(new Error('table does not exist'));
      const result = await service.getKpis('hourly', 24);
      expect(result.totalBuckets).toBe(0);
      expect(result.totalAnomalies).toBe(0);
      expect(result.rows).toEqual([]);
    });

    it('counts anomalies by station correctly', async () => {
      dataSource.query.mockResolvedValue([
        { sensor_id: 's1', station_id: 'st1', bucket: '2026-01-01', avg_value: '10',
          min_value: '5', max_value: '15', stddev_value: '2', reading_count: '10',
          anomaly_flag: true,  rolling_mean: '10', rolling_stddev: '2' },
        { sensor_id: 's2', station_id: 'st1', bucket: '2026-01-01', avg_value: '10',
          min_value: '5', max_value: '15', stddev_value: '2', reading_count: '10',
          anomaly_flag: false, rolling_mean: '10', rolling_stddev: '2' },
        { sensor_id: 's3', station_id: 'st2', bucket: '2026-01-01', avg_value: '10',
          min_value: '5', max_value: '15', stddev_value: '2', reading_count: '10',
          anomaly_flag: true,  rolling_mean: '10', rolling_stddev: '2' },
      ]);

      const result = await service.getKpis('hourly', 24);
      expect(result.totalAnomalies).toBe(2);
      expect(result.anomalyByStation['st1']).toBe(1);
      expect(result.anomalyByStation['st2']).toBe(1);
    });

    it('supports daily granularity', async () => {
      dataSource.query.mockResolvedValue([]);
      const result = await service.getKpis('daily', 168);
      expect(result.granularity).toBe('daily');
      expect(result.windowHours).toBe(168);
    });
  });
});
