import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sensor } from '../database/entities/Sensor.entity';
import { SensorData } from '../database/entities/SensorData.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { AlertsModule } from '../alerts/alerts.module';
import { IotService } from './iot.service';
import { MqttClient } from './mqtt/mqtt.client';
import { KafkaProducerService } from './kafka/kafka.producer.service';
import { KafkaConsumerService } from './kafka/kafka.consumer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sensor, SensorData]),
    RealtimeModule,
    AlertsModule,
  ],
  providers: [IotService, MqttClient, KafkaProducerService, KafkaConsumerService],
  exports: [IotService, MqttClient, KafkaProducerService, KafkaConsumerService],
})
export class IotModule {}
