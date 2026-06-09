import { MqttClient } from '../../iot/mqtt/mqtt.client';
import { WorkflowNode } from '../../common/types/workflow.types';

export class MqttPublishHandler {
  constructor(private readonly mqttClient: MqttClient) {}

  async execute(node: WorkflowNode, input: unknown) {
    const topic = String(node.data?.topic || 'aquaflow/commands');

    let staticPayload: Record<string, unknown> = {};
    try {
      staticPayload = JSON.parse(String(node.data?.payload || '{}'));
    } catch {
      // ignore malformed JSON — use empty object
    }

    const payload =
      typeof input === 'object' && input !== null
        ? { ...staticPayload, ...(input as Record<string, unknown>) }
        : { ...staticPayload, value: input };

    await this.mqttClient.publish(topic, payload);

    return { published: true, topic, payload };
  }
}
