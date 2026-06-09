import { MqttClient } from '../../iot/mqtt/mqtt.client';
import { WorkflowNode } from '../../common/types/workflow.types';

export class PumpControlHandler {
  constructor(private readonly mqttClient: MqttClient) {}

  async execute(node: WorkflowNode, input: unknown) {
    const deviceId = String(node.data?.deviceId || '').trim();
    const command = String(node.data?.command || 'start');
    const topicOverride = node.data?.topic ? String(node.data.topic).trim() : '';
    const topic = topicOverride || `devices/${deviceId}/commands`;

    if (!deviceId) {
      return { error: 'deviceId not configured', sent: false };
    }

    const payload = {
      command,
      deviceId,
      timestamp: new Date().toISOString(),
      source: 'workflow',
    };

    await this.mqttClient.publish(topic, payload);

    return { sent: true, command, deviceId, topic };
  }
}
