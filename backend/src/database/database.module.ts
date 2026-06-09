import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/User.entity';
import { Station } from './entities/Station.entity';
import { Sensor } from './entities/Sensor.entity';
import { SensorData } from './entities/SensorData.entity';
import { Alert } from './entities/Alert.entity';
import { Maintenance } from './entities/Maintenance.entity';
import { Workflow } from './entities/Workflow.entity';
import { WorkflowExecution } from './entities/WorkflowExecution.entity';
import { Notification } from './entities/Notification.entity';
import { DatabaseService } from './database.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST') || 'localhost',
        port: configService.get('DATABASE_PORT') || 5432,
        username: configService.get('DATABASE_USER') || 'postgres',
        password: configService.get('DATABASE_PASSWORD') || 'postgres',
        database: configService.get('DATABASE_NAME') || 'aquaflow',
        entities: [
          User,
          Station,
          Sensor,
          SensorData,
          Alert,
          Maintenance,
          Workflow,
          WorkflowExecution,
          Notification,
        ],
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: configService.get('NODE_ENV') === 'development',
        subscribers: [],
        migrations: configService.get('NODE_ENV') === 'production'
          ? ['dist/database/migrations/*.js']
          : [],
        migrationsRun: false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      Station,
      Sensor,
      SensorData,
      Alert,
      Maintenance,
      Workflow,
      WorkflowExecution,
      Notification,
    ]),
  ],
  providers: [DatabaseService],
  exports: [TypeOrmModule, DatabaseService],
})
export class DatabaseModule {}
