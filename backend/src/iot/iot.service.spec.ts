import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IotService } from './iot.service';
import { Sensor, SensorStatus, SensorType } from '../database/entities/Sensor.entity';
import { SensorData } from '../database/entities/SensorData.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { AlertsService } from '../alerts/alerts.service';
import { AlertSeverity, AlertType } from '../database/entities/Alert.entity';
import { KafkaProducerService } from './kafka/kafka.producer.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeSensor = (overrides: Partial<Sensor> = {}): Sensor => {
  const sensor = {
    id: 'sensor-uuid',
    name: 'Pressure Sensor',
    type: SensorType.PRESSURE,
    unit: 'bar',
    status: SensorStatus.INACTIVE,
    lastReading: null as unknown as number,
    lastReadingAt: null as unknown as Date,
    alertEnabled: false,
    minThreshold: null as unknown as number,
    maxThreshold: null as unknown as number,
    station: { id: 'station-uuid', name: 'Station Alpha' },
    ...overrides,
  };
  // Replicate the entity getter logic
  Object.defineProperty(sensor, 'isThresholdViolated', {
    get() {
      if (!this.lastReading) return false;
      if (this.minThreshold && this.lastReading < this.minThreshold) return true;
      if (this.maxThreshold && this.lastReading > this.maxThreshold) return true;
      return false;
    },
    configurable: true,
  });
  return sensor as unknown as Sensor;
};

const makeSensorData = (): SensorData =>
  ({
    id: 'data-uuid',
    value: 42,
    timestamp: new Date(),
    qualityFlags: {},
  } as unknown as SensorData);

const mockSensorRepo = () => ({
  findOne: jest.fn() as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
  find: jest.fn() as jest.MockedFunction<any>,
});

const mockSensorDataRepo = () => ({
  create: jest.fn((dto: any) => ({ ...dto })) as jest.MockedFunction<any>,
  save: jest.fn() as jest.MockedFunction<any>,
  find: jest.fn() as jest.MockedFunction<any>,
});

const mockRealtimeService = () => ({
  broadcastToAll: jest.fn(),
});

const mockAlertsService = () => ({
  create: jest.fn() as jest.MockedFunction<any>,
});

const mockKafkaProducerService = () => ({
  publishSensorReading: jest.fn().mockResolvedValue(undefined),
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IotService', () => {
  let service: IotService;
  let sensorRepo: ReturnType<typeof mockSensorRepo>;
  let sensorDataRepo: ReturnType<typeof mockSensorDataRepo>;
  let realtimeService: ReturnType<typeof mockRealtimeService>;
  let alertsService: ReturnType<typeof mockAlertsService>;
  let kafkaProducer: ReturnType<typeof mockKafkaProducerService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IotService,
        { provide: getRepositoryToken(Sensor), useFactory: mockSensorRepo },
        { provide: getRepositoryToken(SensorData), useFactory: mockSensorDataRepo },
        { provide: RealtimeService, useFactory: mockRealtimeService },
        { provide: AlertsService, useFactory: mockAlertsService },
        { provide: KafkaProducerService, useFactory: mockKafkaProducerService },
      ],
    }).compile();

    service = module.get(IotService);
    sensorRepo = module.get(getRepositoryToken(Sensor));
    sensorDataRepo = module.get(getRepositoryToken(SensorData));
    realtimeService = module.get(RealtimeService);
    alertsService = module.get(AlertsService);
    kafkaProducer = module.get(KafkaProducerService);

    // Default return values
    sensorRepo.findOne.mockResolvedValue(null);
    sensorRepo.save.mockResolvedValue(makeSensor());
    sensorRepo.find.mockResolvedValue([]);
    sensorDataRepo.save.mockResolvedValue(makeSensorData());
    sensorDataRepo.find.mockResolvedValue([]);
    alertsService.create.mockResolvedValue({});
  });

  // ── processSensorData ─────────────────────────────────────────────────────

  describe('processSensorData', () => {
    it('updates sensor lastReading, lastReadingAt and status to ACTIVE', async () => {
      const sensor = makeSensor({ status: SensorStatus.INACTIVE });
      sensorRepo.findOne.mockResolvedValue(sensor);

      await service.processSensorData('sensor-uuid', 42);

      expect(sensor.lastReading).toBe(42);
      expect(sensor.lastReadingAt).toBeInstanceOf(Date);
      expect(sensor.status).toBe(SensorStatus.ACTIVE);
      expect(sensorRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ lastReading: 42, status: SensorStatus.ACTIVE }),
      );
    });

    it('creates and saves a SensorData record for each reading', async () => {
      sensorRepo.findOne.mockResolvedValue(makeSensor());

      await service.processSensorData('sensor-uuid', 55);

      expect(sensorDataRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ value: 55 }),
      );
      expect(sensorDataRepo.save).toHaveBeenCalled();
    });

    it('broadcasts sensor-update event via RealtimeService', async () => {
      const sensor = makeSensor();
      sensorRepo.findOne.mockResolvedValue(sensor);

      await service.processSensorData('sensor-uuid', 30);

      expect(realtimeService.broadcastToAll).toHaveBeenCalledWith(
        'sensor-update',
        expect.objectContaining({
          sensorId: 'sensor-uuid',
          value: 30,
        }),
      );
    });

    it('publishes a sensor reading event to Kafka after saving', async () => {
      const sensor = makeSensor({ type: SensorType.PRESSURE, unit: 'bar' });
      sensorRepo.findOne.mockResolvedValue(sensor);

      await service.processSensorData('sensor-uuid', 42);

      expect(kafkaProducer.publishSensorReading).toHaveBeenCalledWith(
        expect.objectContaining({
          sensorId: 'sensor-uuid',
          value: 42,
          type: SensorType.PRESSURE,
          unit: 'bar',
        }),
      );
    });

    it('does NOT create alert when threshold is not violated', async () => {
      // minThreshold=10, maxThreshold=100 → value=50 is within range
      const sensor = makeSensor({
        lastReading: 50,
        minThreshold: 10,
        maxThreshold: 100,
        alertEnabled: true,
      });
      sensorRepo.findOne.mockResolvedValue(sensor);

      await service.processSensorData('sensor-uuid', 50);

      expect(alertsService.create).not.toHaveBeenCalled();
    });

    it('creates threshold alert when maxThreshold is exceeded and alertEnabled is true', async () => {
      const sensor = makeSensor({
        lastReading: 150,   // exceeds maxThreshold of 100
        minThreshold: 10,
        maxThreshold: 100,
        alertEnabled: true,
      });
      sensorRepo.findOne.mockResolvedValue(sensor);

      await service.processSensorData('sensor-uuid', 150);

      expect(alertsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.THRESHOLD_VIOLATION,
          severity: AlertSeverity.WARNING,
          sensorId: 'sensor-uuid',
          sourceSystem: 'iot-mqtt',
        }),
      );
    });

    it('creates threshold alert when value is below minThreshold and alertEnabled is true', async () => {
      const sensor = makeSensor({
        lastReading: 2,    // below minThreshold of 10
        minThreshold: 10,
        maxThreshold: 100,
        alertEnabled: true,
      });
      sensorRepo.findOne.mockResolvedValue(sensor);

      await service.processSensorData('sensor-uuid', 2);

      expect(alertsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: AlertType.THRESHOLD_VIOLATION }),
      );
    });

    it('does NOT create alert even when threshold is violated if alertEnabled is false', async () => {
      const sensor = makeSensor({
        lastReading: 999,
        maxThreshold: 100,
        alertEnabled: false,
      });
      sensorRepo.findOne.mockResolvedValue(sensor);

      await service.processSensorData('sensor-uuid', 999);

      expect(alertsService.create).not.toHaveBeenCalled();
    });

    it('returns early and does not throw when sensor is not found', async () => {
      sensorRepo.findOne.mockResolvedValue(null);

      // Should resolve without throwing
      await expect(
        service.processSensorData('nonexistent', 42),
      ).resolves.toBeUndefined();

      expect(sensorRepo.save).not.toHaveBeenCalled();
      expect(realtimeService.broadcastToAll).not.toHaveBeenCalled();
    });

    it('does not propagate error when alertsService.create rejects', async () => {
      const sensor = makeSensor({
        lastReading: 999,
        maxThreshold: 100,
        alertEnabled: true,
      });
      sensorRepo.findOne.mockResolvedValue(sensor);
      alertsService.create.mockRejectedValue(new Error('DB error'));

      // The service catches alert creation errors internally
      await expect(
        service.processSensorData('sensor-uuid', 999),
      ).resolves.toBeUndefined();
    });
  });

  // ── getSensorStatus ───────────────────────────────────────────────────────

  describe('getSensorStatus', () => {
    it('returns sensor when found', async () => {
      const sensor = makeSensor();
      sensorRepo.findOne.mockResolvedValue(sensor);

      const result = await service.getSensorStatus('sensor-uuid');

      expect(result).toEqual(sensor);
      expect(sensorRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'sensor-uuid' },
      });
    });

    it('returns null when sensor is not found', async () => {
      sensorRepo.findOne.mockResolvedValue(null);

      const result = await service.getSensorStatus('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ── getActiveStationSensors ───────────────────────────────────────────────

  describe('getActiveStationSensors', () => {
    it('returns only ACTIVE sensors for the given station', async () => {
      const activeSensors = [
        makeSensor({ id: 's1', status: SensorStatus.ACTIVE }),
        makeSensor({ id: 's2', status: SensorStatus.ACTIVE }),
      ];
      sensorRepo.find.mockResolvedValue(activeSensors);

      const result = await service.getActiveStationSensors('station-uuid');

      expect(result).toEqual(activeSensors);
      expect(sensorRepo.find).toHaveBeenCalledWith({
        where: {
          station: { id: 'station-uuid' },
          status: SensorStatus.ACTIVE,
        },
      });
    });

    it('returns empty array when station has no active sensors', async () => {
      sensorRepo.find.mockResolvedValue([]);

      const result = await service.getActiveStationSensors('station-uuid');

      expect(result).toEqual([]);
    });
  });
});
