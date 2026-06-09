import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, Producer, RecordMetadata } from 'kafkajs';

export interface SensorReadingMessage {
  sensorId: string;
  stationId: string | undefined;
  type: string;
  value: number;
  unit: string;
  timestamp: string;
  thresholdViolated: boolean;
}

export const TOPIC_SENSOR_READINGS = 'sensors.readings';

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducerService.name);
  private producer: Producer | null = null;
  private connected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.configService.get<string>('KAFKA_BROKERS');
    if (!brokers) {
      this.logger.warn('KAFKA_BROKERS not set — Kafka producer disabled');
      return;
    }

    const kafka = new Kafka({
      clientId: 'aquaflow-backend',
      brokers: brokers.split(',').map((b) => b.trim()),
      retry: {
        initialRetryTime: 300,
        retries: 5,
      },
    });

    this.producer = kafka.producer({
      allowAutoTopicCreation: true,
    });

    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.log(`Kafka producer connected → ${brokers}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Kafka producer failed to connect (${msg}) — running without Kafka`);
      this.producer = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer && this.connected) {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    }
  }

  async publishSensorReading(message: SensorReadingMessage): Promise<void> {
    if (!this.producer || !this.connected) return;

    try {
      const records: RecordMetadata[] = await this.producer.send({
        topic: TOPIC_SENSOR_READINGS,
        messages: [
          {
            // Partition by sensorId so readings for the same sensor are ordered
            key: message.sensorId,
            value: JSON.stringify(message),
            timestamp: String(Date.now()),
          },
        ],
      });

      this.logger.debug(
        `Published sensor reading → ${TOPIC_SENSOR_READINGS} ` +
        `[partition=${records[0]?.partition}, offset=${records[0]?.offset}]`,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to publish sensor reading to Kafka: ${msg}`);
    }
  }
}
