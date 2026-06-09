import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AlertsService } from '../../alerts/alerts.service';
import {
  KafkaConsumerService,
  AnomalyMessage,
  TOPIC_SENSOR_ANOMALIES,
} from './kafka.consumer.service';
import {
  SensorReadingMessage,
  TOPIC_SENSOR_READINGS,
} from './kafka.producer.service';
import { AlertSeverity, AlertType } from '../../database/entities/Alert.entity';

// ─── Mocks ────────────────────────────────────────────────────────────────────

let capturedEachMessage: ((payload: any) => Promise<void>) | undefined;

const mockRun = jest.fn().mockImplementation(async ({ eachMessage }) => {
  capturedEachMessage = eachMessage;
});
const mockConsumerConnect = jest.fn();
const mockConsumerSubscribe = jest.fn();
const mockConsumerDisconnect = jest.fn();

const mockConsumer = {
  connect: mockConsumerConnect,
  subscribe: mockConsumerSubscribe,
  run: mockRun,
  disconnect: mockConsumerDisconnect,
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    consumer: jest.fn().mockReturnValue(mockConsumer),
  })),
}));

const mockAlertsService = () => ({
  create: jest.fn().mockResolvedValue({ id: 'alert-1' }),
});

const makeReading = (overrides: Partial<SensorReadingMessage> = {}): SensorReadingMessage => ({
  sensorId: 'sensor-1',
  stationId: 'station-1',
  type: 'pressure',
  value: 42,
  unit: 'bar',
  timestamp: new Date().toISOString(),
  thresholdViolated: false,
  ...overrides,
});

const makeAnomaly = (overrides: Partial<AnomalyMessage> = {}): AnomalyMessage => ({
  sensorId: 'sensor-1',
  stationId: 'station-1',
  type: 'pressure',
  value: 99,
  unit: 'bar',
  timestamp: new Date().toISOString(),
  zScore: 3.5,
  rollingMean: 42,
  rollingStddev: 5,
  windowMinutes: 5,
  ...overrides,
});

const makeKafkaMessage = (topic: string, payload: object) => ({
  topic,
  partition: 0,
  message: {
    offset: '0',
    value: Buffer.from(JSON.stringify(payload)),
  },
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('KafkaConsumerService', () => {
  let service: KafkaConsumerService;
  let alertsService: ReturnType<typeof mockAlertsService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedEachMessage = undefined;

    mockConsumerConnect.mockResolvedValue(undefined);
    mockConsumerSubscribe.mockResolvedValue(undefined);
    mockConsumerDisconnect.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaConsumerService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('kafka:9092') },
        },
        { provide: AlertsService, useFactory: mockAlertsService },
      ],
    }).compile();

    service = module.get(KafkaConsumerService);
    alertsService = module.get(AlertsService);

    await service.onModuleInit();
  });

  // ── onModuleInit ────────────────────────────────────────────────────────────

  describe('onModuleInit', () => {
    it('subscribes to both sensor topics', () => {
      expect(mockConsumerSubscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          topics: expect.arrayContaining([TOPIC_SENSOR_READINGS, TOPIC_SENSOR_ANOMALIES]),
        }),
      );
    });

    it('sets running=true after successful init', () => {
      expect(service.getIsRunning()).toBe(true);
    });

    it('stays offline when KAFKA_BROKERS is not set', async () => {
      const module2 = await Test.createTestingModule({
        providers: [
          KafkaConsumerService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
          { provide: AlertsService, useFactory: mockAlertsService },
        ],
      }).compile();

      const svc2 = module2.get(KafkaConsumerService);
      await svc2.onModuleInit();
      expect(svc2.getIsRunning()).toBe(false);
    });
  });

  // ── getPipelineStats ────────────────────────────────────────────────────────

  describe('getPipelineStats', () => {
    it('starts with zero counts', () => {
      const stats = service.getPipelineStats();
      expect(stats.readingsConsumed).toBe(0);
      expect(stats.anomaliesConsumed).toBe(0);
      expect(stats.lastReadingAt).toBeNull();
      expect(stats.lastAnomalyAt).toBeNull();
    });

    it('increments readingsConsumed when a sensor reading arrives', async () => {
      await capturedEachMessage!(makeKafkaMessage(TOPIC_SENSOR_READINGS, makeReading()));
      expect(service.getPipelineStats().readingsConsumed).toBe(1);
    });

    it('increments anomaliesConsumed when an anomaly message arrives', async () => {
      await capturedEachMessage!(makeKafkaMessage(TOPIC_SENSOR_ANOMALIES, makeAnomaly()));
      expect(service.getPipelineStats().anomaliesConsumed).toBe(1);
    });
  });

  // ── registerReadingHandler ──────────────────────────────────────────────────

  describe('registerReadingHandler', () => {
    it('calls registered handler when a reading is received', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      service.registerReadingHandler(handler);

      const reading = makeReading({ value: 77 });
      await capturedEachMessage!(makeKafkaMessage(TOPIC_SENSOR_READINGS, reading));

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ value: 77 }));
    });

    it('continues processing even when a registered handler throws', async () => {
      service.registerReadingHandler(jest.fn().mockRejectedValue(new Error('handler crash')));
      await expect(
        capturedEachMessage!(makeKafkaMessage(TOPIC_SENSOR_READINGS, makeReading())),
      ).resolves.toBeUndefined();
    });
  });

  // ── anomaly alert creation ──────────────────────────────────────────────────

  describe('anomaly alert creation', () => {
    it('creates an alert when anomaly message is received', async () => {
      await capturedEachMessage!(makeKafkaMessage(TOPIC_SENSOR_ANOMALIES, makeAnomaly()));
      expect(alertsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AlertType.ANOMALY,
          sourceSystem: 'spark-streaming',
        }),
      );
    });

    it('assigns WARNING severity for z-score between 2.5 and 3', async () => {
      await capturedEachMessage!(
        makeKafkaMessage(TOPIC_SENSOR_ANOMALIES, makeAnomaly({ zScore: 2.7 })),
      );
      expect(alertsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: AlertSeverity.WARNING }),
      );
    });

    it('assigns ERROR severity for z-score between 3 and 4', async () => {
      await capturedEachMessage!(
        makeKafkaMessage(TOPIC_SENSOR_ANOMALIES, makeAnomaly({ zScore: 3.5 })),
      );
      expect(alertsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: AlertSeverity.ERROR }),
      );
    });

    it('assigns CRITICAL severity for z-score >= 4', async () => {
      await capturedEachMessage!(
        makeKafkaMessage(TOPIC_SENSOR_ANOMALIES, makeAnomaly({ zScore: 4.2 })),
      );
      expect(alertsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ severity: AlertSeverity.CRITICAL }),
      );
    });

    it('does not rethrow when alertsService.create fails', async () => {
      alertsService.create.mockRejectedValue(new Error('DB down'));
      await expect(
        capturedEachMessage!(makeKafkaMessage(TOPIC_SENSOR_ANOMALIES, makeAnomaly())),
      ).resolves.toBeUndefined();
    });
  });

  // ── malformed messages ──────────────────────────────────────────────────────

  describe('malformed messages', () => {
    it('does nothing when message.value is null', async () => {
      await expect(
        capturedEachMessage!({ topic: TOPIC_SENSOR_READINGS, partition: 0, message: { value: null } }),
      ).resolves.toBeUndefined();
      expect(alertsService.create).not.toHaveBeenCalled();
    });

    it('does not throw on invalid JSON', async () => {
      await expect(
        capturedEachMessage!({
          topic: TOPIC_SENSOR_READINGS,
          partition: 0,
          message: { value: Buffer.from('not-json') },
        }),
      ).resolves.toBeUndefined();
    });
  });

  // ── onModuleDestroy ─────────────────────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('disconnects consumer on module destroy', async () => {
      await service.onModuleDestroy();
      expect(mockConsumerDisconnect).toHaveBeenCalled();
    });
  });
});
