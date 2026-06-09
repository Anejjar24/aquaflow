import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowSchedulerService } from './workflow-scheduler.service';
import { AlertsModule } from '../alerts/alerts.module';
import { Sensor } from '../database/entities/Sensor.entity';
import { SensorData } from '../database/entities/SensorData.entity';
import { Workflow } from '../database/entities/Workflow.entity';
import { Notification } from '../database/entities/Notification.entity';
import { WorkflowExecution } from '../database/entities/WorkflowExecution.entity';
import { IotModule } from '../iot/iot.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { StationsModule } from '../stations/stations.module';
import { NodeExecutor } from '../execution/engine/node-executor';
import { WorkflowRunner } from '../execution/engine/workflow-runner';
import { FlowExecutorService } from './flow-executor.service';
import { FlowValidatorService } from './flow-validator.service';
import { FlowsController } from './flows.controller';
import { FlowsService } from './flows.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, Sensor, SensorData, Notification, WorkflowExecution]),
    AlertsModule,
    IotModule,
    RealtimeModule,
    StationsModule,
  ],
  controllers: [FlowsController],
  providers: [
    FlowExecutorService,
    FlowValidatorService,
    FlowsService,
    NodeExecutor,
    WorkflowRunner,
    WorkflowSchedulerService,
  ],
  exports: [FlowExecutorService, FlowsService],
})
export class FlowsModule {}
