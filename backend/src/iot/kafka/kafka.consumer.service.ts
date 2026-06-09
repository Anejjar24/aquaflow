import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, KafkaMessage } from 'kafkajs';
import { AlertsService } from '../../alerts/alerts.service';
import { AlertSeverity, AlertType } from '../../database/entities/Alert.entity';
import { TOPIC_SENSOR_READINGS, SensorReadingMessage } from './kafka.producer.service';

export const TOPIC_SENSOR_ANOMALIES = 'sensors.anomalies';

/** Shape of an anomaly event produced by Spark Streaming (Task 12) */
export interface AnomalyMessage {
  sensorId: string;
  stationId?: string;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
  zScore: number;           // how many stddevs from rolling mean
  rollingMean: number;
  rollingStddev: number;
  windowMinutes: number;
}

/** Pipeline statistics exposed to the Analytics API */
export interface PipelineStats {
  readingsConsumed: number;
  anomaliesConsumed: number;
  lastReadingAt: string | null;
  lastAnomalyAt: string | null;
  consumerGroupId: string;
}

/** Handler called for every sensor reading that arrives via Kafka.
 *  Used by downstream pipeline stages (e.g. Task 8 MinIO forwarder). */
export type ReadingHandler = (msg: SensorReadingMessage) => Promise<void> | void;

const CONSUMER_GROUP_ID = 'aquaflow-pipeline';

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaConsumerService.name);
  private consumer: Consumer | null = null;
  private running = false;

  private stats: PipelineStats = {
    readingsConsumed: 0,
    anomaliesConsumed: 0,
    lastReadingAt: null,
    lastAnomalyAt: null,
    consumerGroupId: CONSUMER_GROUP_ID,
  };

  private readonly readingHandlers: ReadingHandler[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly alertsService: AlertsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not set — Kafka consumer disabled');
      return;
    }

    const kafka = new Kafka({
      clientId: 'aquaflow-consumer',
      brokers: brokers.split(',').map((b) => b.trim()),
      retry: { initialRetryTime: 300, retries: 8 },
    });

    this.consumer = kafka.consumer({
      groupId: CONSUMER_GROUP_ID,
      // Allow at most 5 s lag before rebalancing
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
    });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [TOPIC_SENSOR_READINGS, TOPIC_SENSOR_ANOMALIES],
        fromBeginning: false,
      });

      this.running = true;
      this.logger.log(
        `Kafka consumer [${CONSUMER_GROUP_ID}] subscribed → ` +
        `[${TOPIC_SENSOR_READINGS}, ${TOPIC_SENSOR_ANOMALIES}]`,
      );

      // Run in background — do not await
      this.consumer
        .run({ eachMessage: (payload) => this.handleMessage(payload) })
        .catch((err) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Kafka consumer run error: ${msg}`);
          this.running = false;
        });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Kafka consumer failed to start (${msg}) — running without consumer`);
      this.consumer = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer && this.running) {
      await this.consumer.disconnect();
      this.logger.log('Kafka consumer disconnected');
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Register a downstream handler that receives every sensor reading.
   *  Used by the MinIO forwarder (Task 8) and future pipeline stages. */
  registerReadingHandler(handler: ReadingHandler): void {
    this.readingHandlers.push(handler);
    this.logger.log(`Pipeline handler registered (total: ${this.readingHandlers.length})`);
  }

  getPipelineStats(): PipelineStats {
    return { ...this.stats };
  }

  getIsRunning(): boolean {
    return this.running;
  }

  // ── Message dispatch ───────────────────────────────────────────────────────

  private async handleMessage({
    topic,
    partition,
    message,
  }: {
    topic: string;
    partition: number;
    message: KafkaMessage;
  }): Promise<void> {
    if (!message.value) return;

    try {
      const payload = JSON.parse(message.value.toString());
      this.logger.debug(`[${topic}] partition=${partition} offset=${message.offset}`);

      if (topic === TOPIC_SENSOR_READINGS) {
        await this.onSensorReading(payload as SensorReadingMessage);
      } else if (topic === TOPIC_SENSOR_ANOMALIES) {
        await this.onSensorAnomaly(payload as AnomalyMessage);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to handle Kafka message on ${topic}: ${msg}`);
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  private async onSensorReading(msg: SensorReadingMessage): Promise<void> {
    this.stats.readingsConsumed += 1;
    this.stats.lastReadingAt = new Date().toISOString();

    // Fan-out to all registered pipeline handlers (MinIO forwarder, etc.)
    for (const handler of this.readingHandlers) {
      try {
        await handler(msg);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Reading pipeline handler error: ${errMsg}`);
      }
    }
  }

  private async onSensorAnomaly(msg: AnomalyMessage): Promise<void> {
    this.stats.anomaliesConsumed += 1;
    this.stats.lastAnomalyAt = new Date().toISOString();

    const severity = msg.zScore >= 4 ? AlertSeverity.CRITICAL
      : msg.zScore >= 3 ? AlertSeverity.ERROR
      : AlertSeverity.WARNING;

    try {
      await this.alertsService.create({
        type: AlertType.ANOMALY,
        severity,
        message: `Anomaly detected on sensor ${msg.sensorId}: value=${msg.value} ${msg.unit} (z-score=${msg.zScore.toFixed(2)})`,
        description:
          `Spark Streaming detected a statistical anomaly. ` +
          `Rolling mean: ${msg.rollingMean.toFixed(2)}, stddev: ${msg.rollingStddev.toFixed(2)}, ` +
          `window: ${msg.windowMinutes} min.`,
        stationId: msg.stationId,
        sensorId: msg.sensorId,
        sourceSystem: 'spark-streaming',
        data: {
          value: msg.value,
          zScore: msg.zScore,
          rollingMean: msg.rollingMean,
          rollingStddev: msg.rollingStddev,
          windowMinutes: msg.windowMinutes,
          timestamp: msg.timestamp,
        },
      });

      this.logger.warn(
        `Anomaly alert created for sensor ${msg.sensorId} ` +
        `[severity=${severity}, z=${msg.zScore.toFixed(2)}]`,
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to create anomaly alert: ${errMsg}`);
    }
  }
}
