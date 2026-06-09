import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from '../database/entities/Alert.entity';
import { Maintenance } from '../database/entities/Maintenance.entity';
import { Sensor } from '../database/entities/Sensor.entity';
import { SensorAggregate } from '../database/entities/SensorAggregate.entity';
import { SensorData } from '../database/entities/SensorData.entity';
import { Station } from '../database/entities/Station.entity';
import { IotModule } from '../iot/iot.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Station, Sensor, Alert, Maintenance, SensorData, SensorAggregate]),
    IotModule,   // provides KafkaConsumerService (for pipeline/stats endpoint)
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
