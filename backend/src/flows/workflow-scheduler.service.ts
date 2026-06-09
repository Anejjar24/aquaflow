import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { CronJob } from 'cron';
import { Workflow, WorkflowTriggerType } from '../database/entities/Workflow.entity';
import { WorkflowGraph } from '../common/types/workflow.types';
import { FlowExecutorService } from './flow-executor.service';
import { MqttClient } from '../iot/mqtt/mqtt.client';

@Injectable()
export class WorkflowSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowSchedulerService.name);

  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepo: Repository<Workflow>,
    private readonly executorService: FlowExecutorService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly mqttClient: MqttClient,
  ) {}

  async onModuleInit(): Promise<void> {
    // Load all active scheduled workflows on startup
    try {
      await this.loadScheduledWorkflows();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to load scheduled workflows on startup: ${msg}`);
    }

    // Register MQTT sensor_threshold handler
    this.registerSensorThresholdHandler();
  }

  // ─── Scheduled Workflows (cron) ─────────────────────────────────────────────

  async loadScheduledWorkflows(): Promise<void> {
    const workflows = await this.workflowRepo.find({
      where: { isActive: true, triggerType: WorkflowTriggerType.SCHEDULED },
    });

    this.logger.log(`Loaded ${workflows.length} scheduled workflow(s)`);

    for (const workflow of workflows) {
      this.registerCronJob(workflow);
    }
  }

  registerCronJob(workflow: Workflow): void {
    const cron = workflow.triggerConfig?.cron as string | undefined;
    if (!cron) {
      this.logger.warn(
        `Workflow "${workflow.name}" (${workflow.id}) has no cron expression — skipping`,
      );
      return;
    }

    const jobName = `wf:${workflow.id}`;

    // Remove existing job if already registered
    try {
      this.schedulerRegistry.deleteCronJob(jobName);
    } catch {
      // Job did not exist — fine
    }

    try {
      const job = new CronJob(cron, async () => {
        this.logger.log(`Running scheduled workflow: "${workflow.name}" (${workflow.id})`);
        try {
          await this.executorService.execute(workflow.graph as WorkflowGraph, {}, {
            workflowId: workflow.id,
            triggerSource: 'scheduled',
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`Scheduled workflow "${workflow.name}" failed: ${msg}`);
        }
      });

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();
      this.logger.log(`Registered cron "${cron}" for workflow "${workflow.name}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Could not register cron for workflow "${workflow.name}" (${workflow.id}): ${msg}`,
      );
    }
  }

  /**
   * Reload a single workflow's cron job.
   * Called by FlowsController after activate/deactivate or save with trigger config.
   */
  async reloadWorkflow(workflowId: string): Promise<void> {
    const jobName = `wf:${workflowId}`;

    // Remove existing cron job (if any)
    try {
      this.schedulerRegistry.deleteCronJob(jobName);
    } catch {
      // Didn't exist
    }

    const workflow = await this.workflowRepo.findOne({ where: { id: workflowId } });
    if (!workflow) return;

    if (workflow.isActive && workflow.triggerType === WorkflowTriggerType.SCHEDULED) {
      this.registerCronJob(workflow);
    } else {
      this.logger.log(
        `Workflow "${workflow.name}" is inactive or not scheduled — cron job removed`,
      );
    }
  }

  // ─── MQTT Sensor Threshold Trigger ─────────────────────────────────────────

  /**
   * Register a global MQTT message handler.
   * When sensor data arrives on `sensors/:id/data`, check all active
   * sensor_threshold workflows and execute any whose conditions are met.
   */
  registerSensorThresholdHandler(): void {
    this.mqttClient.registerHandler(async (topic: string, payload: Buffer) => {
      // Only process sensor data messages
      if (!topic.startsWith('sensors/') || !topic.endsWith('/data')) return;

      const parts = topic.split('/');
      const sensorId = parts[1];
      if (!sensorId) return;

      // Parse value from payload
      let value: number;
      try {
        const message = JSON.parse(payload.toString()) as { value?: unknown };
        const raw = message?.value;
        value = typeof raw === 'number' ? raw : Number(raw);
        if (Number.isNaN(value)) return;
      } catch {
        return;
      }

      // Find all active sensor_threshold workflows
      let workflows: Workflow[];
      try {
        workflows = await this.workflowRepo.find({
          where: { isActive: true, triggerType: WorkflowTriggerType.SENSOR_THRESHOLD },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to query sensor_threshold workflows: ${msg}`);
        return;
      }

      for (const workflow of workflows) {
        const config = workflow.triggerConfig;
        if (!config || config['sensorId'] !== sensorId) continue;

        const threshold = Number(config['threshold'] ?? 0);
        const condition = String(config['condition'] ?? 'any');

        const triggered =
          condition === 'any' ||
          (condition === 'above' && value > threshold) ||
          (condition === 'below' && value < threshold);

        if (!triggered) continue;

        this.logger.log(
          `MQTT trigger: workflow "${workflow.name}" fired — sensor ${sensorId} = ${value} (${condition} ${threshold})`,
        );

        // Fire-and-forget; errors are caught and logged
        this.executorService
          .execute(workflow.graph as WorkflowGraph, { sensorId, value }, {
            workflowId: workflow.id,
            triggerSource: 'sensor_threshold',
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(
              `MQTT-triggered workflow "${workflow.name}" failed: ${msg}`,
            );
          });
      }
    });
  }
}
