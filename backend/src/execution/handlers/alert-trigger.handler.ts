import { AlertSeverity, AlertType } from '../../database/entities/Alert.entity';
import { AlertsService } from '../../alerts/alerts.service';
import { WorkflowNode } from '../../common/types/workflow.types';

export class AlertTriggerHandler {
  constructor(private readonly alertsService: AlertsService) {}

  async execute(node: WorkflowNode, input: unknown) {
    const rawType = String(node.data?.type || 'system_error');
    const rawSeverity = String(node.data?.severity || 'warning');
    const message = String(node.data?.message || 'Workflow-triggered alert');
    const stationId = node.data?.stationId ? String(node.data.stationId) : undefined;

    const type = Object.values(AlertType).includes(rawType as AlertType)
      ? (rawType as AlertType)
      : AlertType.SYSTEM_ERROR;

    const severity = Object.values(AlertSeverity).includes(rawSeverity as AlertSeverity)
      ? (rawSeverity as AlertSeverity)
      : AlertSeverity.WARNING;

    const alert = await this.alertsService.create({
      type,
      severity,
      message,
      stationId,
      sourceSystem: 'workflow',
      data: { workflowInput: input },
    });

    return {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
      status: alert.status,
    };
  }
}
