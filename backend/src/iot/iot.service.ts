import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sensor, SensorStatus } from '../database/entities/Sensor.entity';
import { SensorData } from '../database/entities/SensorData.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { AlertsService } from '../alerts/alerts.service';
import { AlertSeverity, AlertType } from '../database/entities/Alert.entity';
import { KafkaProducerService } from './kafka/kafka.producer.service';

@Injectable()
export class IotService {
  private readonly logger = new Logger(IotService.name);

  constructor(
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    @InjectRepository(SensorData)
    private readonly sensorDataRepository: Repository<SensorData>,
    private readonly realtimeService: RealtimeService,
    private readonly alertsService: AlertsService,
    private readonly kafkaProducer: KafkaProducerService,
  ) {}

  async processSensorData(sensorId: string, value: number): Promise<void> {
    try {
      const sensor = await this.sensorRepository.findOne({
        where: { id: sensorId },
      });

      if (!sensor) {
        this.logger.warn(`Sensor not found: ${sensorId}`);
        return;
      }

      // Update sensor last reading
      sensor.lastReading = value;
      sensor.lastReadingAt = new Date();
      sensor.status = SensorStatus.ACTIVE;

      // Check thresholds
      const thresholdViolated = sensor.isThresholdViolated;

      await this.sensorRepository.save(sensor);

      // Save sensor data
      const sensorData = this.sensorDataRepository.create({
        sensor,
        value,
        timestamp: new Date(),
        qualityFlags: {},
      });
      await this.sensorDataRepository.save(sensorData);

      // Publish to Kafka (fire-and-forget — never blocks the MQTT pipeline)
      this.kafkaProducer.publishSensorReading({
        sensorId: sensor.id,
        stationId: sensor.station?.id,
        type: sensor.type,
        value,
        unit: sensor.unit,
        timestamp: sensorData.timestamp.toISOString(),
        thresholdViolated,
      }).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Kafka publish failed for sensor ${sensorId}: ${msg}`);
      });

      // Broadcast update via WebSocket
      this.realtimeService.broadcastToAll('sensor-update', {
        sensorId: sensor.id,
        stationId: sensor.station?.id,
        value,
        timestamp: new Date(),
        thresholdViolated,
        status: sensor.status,
      });

      if (thresholdViolated && sensor.alertEnabled) {
        this.logger.warn(
          `Threshold violation for sensor ${sensorId}: ${value}`,
        );

        // Create persistent alert
        try {
          const severity = AlertSeverity.WARNING;
          const message = `Threshold violation on sensor ${sensor.name}: ${value}`;
          const description = `Sensor reading ${value} violates thresholds (min: ${sensor.minThreshold}, max: ${sensor.maxThreshold})`;

          await this.alertsService.create({
            type: AlertType.THRESHOLD_VIOLATION,
            severity,
            message,
            description,
            stationId: sensor.station?.id,
            sensorId: sensor.id,
            sourceSystem: 'iot-mqtt',
            data: {
              value,
              minThreshold: sensor.minThreshold,
              maxThreshold: sensor.maxThreshold,
            },
          });
        } catch (alertError) {
          const msg =
            alertError instanceof Error
              ? alertError.message
              : String(alertError);
          this.logger.error(
            `Failed to create threshold alert for sensor ${sensorId}: ${msg}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process sensor data for ${sensorId}`,
        error,
      );
    }
  }

  async getSensorData(
    sensorId: string,
    limit: number = 100,
  ): Promise<SensorData[]> {
    return this.sensorDataRepository.find({
      where: { sensor: { id: sensorId } },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getSensorStatus(sensorId: string): Promise<Sensor | null> {
    return this.sensorRepository.findOne({
      where: { id: sensorId },
    });
  }

  async getActiveStationSensors(stationId: string): Promise<Sensor[]> {
    return this.sensorRepository.find({
      where: {
        station: { id: stationId },
        status: SensorStatus.ACTIVE,
      },
    });
  }
}
