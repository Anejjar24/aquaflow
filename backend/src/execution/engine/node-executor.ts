import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertsService } from '../../alerts/alerts.service';
import { WorkflowNode } from '../../common/types/workflow.types';
import { Sensor } from '../../database/entities/Sensor.entity';
import { SensorData } from '../../database/entities/SensorData.entity';
import { Notification } from '../../database/entities/Notification.entity';
import { MqttClient } from '../../iot/mqtt/mqtt.client';
import { RealtimeService } from '../../realtime/realtime.service';
import { StationsService } from '../../stations/stations.service';

// Generic handlers
import { ActionHandler }        from '../handlers/action.handler';
import { DataTransformHandler } from '../handlers/data-transform.handler';
import { DecisionHandler }      from '../handlers/decision.handler';
import { HttpRequestHandler }   from '../handlers/http-request.handler';
import { InputHandler }         from '../handlers/input.handler';
import { NotificationHandler }  from '../handlers/notification.handler';
import { OutputHandler }        from '../handlers/output.handler';
import { ThresholdCheckHandler } from '../handlers/threshold-check.handler';

// Industrial handlers — core
import { AlertTriggerHandler }  from '../handlers/alert-trigger.handler';
import { MqttPublishHandler }   from '../handlers/mqtt-publish.handler';
import { PumpControlHandler }   from '../handlers/pump-control.handler';
import { SensorReadHandler }    from '../handlers/sensor-read.handler';
import { StationControlHandler } from '../handlers/station-control.handler';

// Industrial handlers — extended
import { DataAggregateHandler } from '../handlers/data-aggregate.handler';
import { DataOutputHandler }    from '../handlers/data-output.handler';
import { SensorCheckHandler }   from '../handlers/sensor-check.handler';
import { StreamFilterHandler }  from '../handlers/stream-filter.handler';
import { ValueTransformHandler } from '../handlers/value-transform.handler';
import { CustomCalcHandler }    from '../handlers/custom-calc.handler';

import { ExecutionContext } from './execution-context';

@Injectable()
export class NodeExecutor {
  // ── Generic handlers (no external deps) ─────────────────────────────────────
  private readonly inputHandler          = new InputHandler();
  private readonly actionHandler         = new ActionHandler();
  private readonly dataTransformHandler  = new DataTransformHandler();
  private readonly decisionHandler       = new DecisionHandler();
  private readonly outputHandler         = new OutputHandler();
  private readonly thresholdCheckHandler = new ThresholdCheckHandler();
  private readonly httpRequestHandler    = new HttpRequestHandler();

  // ── Stateless extended handlers ──────────────────────────────────────────────
  private readonly valueTransformHandler = new ValueTransformHandler();
  private readonly sensorCheckHandler    = new SensorCheckHandler();
  private readonly streamFilterHandler   = new StreamFilterHandler();

  // ── Custom calculation handler ───────────────────────────────────────────────
  private readonly customCalcHandler: CustomCalcHandler;

  // ── Handlers with DB / service dependencies ──────────────────────────────────
  private readonly sensorReadHandler:     SensorReadHandler;
  private readonly alertTriggerHandler:   AlertTriggerHandler;
  private readonly mqttPublishHandler:    MqttPublishHandler;
  private readonly notificationHandler:   NotificationHandler;
  private readonly pumpControlHandler:    PumpControlHandler;
  private readonly stationControlHandler: StationControlHandler;
  private readonly dataAggregateHandler:  DataAggregateHandler;
  private readonly dataOutputHandler:     DataOutputHandler;

  constructor(
    @InjectRepository(Sensor)     sensorRepository:     Repository<Sensor>,
    @InjectRepository(SensorData) sensorDataRepository: Repository<SensorData>,
    @InjectRepository(Notification) notificationRepository: Repository<Notification>,
    alertsService:    AlertsService,
    mqttClient:       MqttClient,
    realtimeService:  RealtimeService,
    stationsService:  StationsService,
  ) {
    // Core industrial
    this.sensorReadHandler     = new SensorReadHandler(sensorRepository, sensorDataRepository);
    this.alertTriggerHandler   = new AlertTriggerHandler(alertsService);
    this.mqttPublishHandler    = new MqttPublishHandler(mqttClient);
    this.notificationHandler   = new NotificationHandler(notificationRepository, realtimeService);
    this.pumpControlHandler    = new PumpControlHandler(mqttClient);
    this.stationControlHandler = new StationControlHandler(stationsService);

    // Extended industrial
    this.dataAggregateHandler  = new DataAggregateHandler(sensorRepository);
    this.dataOutputHandler     = new DataOutputHandler(sensorDataRepository, sensorRepository);

    // Custom calc
    this.customCalcHandler     = new CustomCalcHandler(sensorRepository, sensorDataRepository);
  }

  async execute(node: WorkflowNode, input: unknown, context: ExecutionContext) {
    switch (node.type) {

      // ── Generic blocks ───────────────────────────────────────────────────────
      case 'input':          return this.inputHandler.execute(node, context);
      case 'action':         return this.actionHandler.execute(node, input);
      case 'data-transform': return this.dataTransformHandler.execute(node, input);
      case 'decision':       return this.decisionHandler.execute(node, input);
      case 'output':         return this.outputHandler.execute(node, input);
      case 'delay':          return this.handleDelay(node, input);
      case 'notification':   return this.notificationHandler.execute(node, input);
      // legacy alias kept for backward compatibility with pre-Task-5 workflows
      case 'api':            return this.httpRequestHandler.execute(node, input);

      // ── Industrial blocks — core ─────────────────────────────────────────────
      case 'sensor-read':     return this.sensorReadHandler.execute(node, input);
      case 'threshold-check': return this.thresholdCheckHandler.execute(node, input);
      case 'alert-trigger':   return this.alertTriggerHandler.execute(node, input);
      case 'mqtt-publish':    return this.mqttPublishHandler.execute(node, input);
      case 'pump-control':    return this.pumpControlHandler.execute(node, input);
      case 'station-control': return this.stationControlHandler.execute(node, input);

      // ── Industrial blocks — extended ─────────────────────────────────────────
      case 'value-transform': return this.valueTransformHandler.execute(node, input);
      case 'sensor-check':    return this.sensorCheckHandler.execute(node, input);
      case 'data-aggregate':  return this.dataAggregateHandler.execute(node, input);
      case 'stream-filter':   return this.streamFilterHandler.execute(node, input);
      case 'data-output':     return this.dataOutputHandler.execute(node, input);

      // ── Integration blocks ───────────────────────────────────────────────────
      case 'http-request':    return this.httpRequestHandler.execute(node, input);

      // ── Custom calculation ────────────────────────────────────────────────────
      case 'custom-calc':     return this.customCalcHandler.execute(node, input);

      default: return input;
    }
  }

  private async handleDelay(node: WorkflowNode, input: unknown): Promise<unknown> {
    const ms = Math.min(Number(node.data?.durationMs ?? 500), 30_000);
    await new Promise((resolve) => setTimeout(resolve, ms));
    return input;
  }
}
