import { Repository } from 'typeorm';
import { WorkflowNode } from '../../common/types/workflow.types';
import {
  Notification,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../../database/entities/Notification.entity';
import { RealtimeService } from '../../realtime/realtime.service';

export class NotificationHandler {
  constructor(
    private readonly notificationRepo: Repository<Notification>,
    private readonly realtimeService: RealtimeService,
  ) {}

  async execute(node: WorkflowNode, input: unknown) {
    const channel = String(node.data?.channel || 'in_app');
    const subject = String(node.data?.subject || 'Workflow Notification');
    const contentTemplate = String(node.data?.message || node.data?.content || '');
    const content = contentTemplate || JSON.stringify(input);

    // 'in_app' is the default and the only channel that works without
    // external configuration.  'email', 'sms', 'slack' are legacy UI values
    // that fall back to in_app so old saved workflows still produce a
    // notification rather than silently returning notified:false.
    if (channel === 'in_app' || channel === 'email' || channel === 'sms' || channel === 'slack') {
      return this.sendInApp(subject, content);
    }

    if (channel === 'webhook') {
      return this.sendWebhook(node, subject, content, input);
    }

    return { notified: false, reason: `unsupported channel: ${channel}` };
  }

  private async sendInApp(subject: string, content: string) {
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        type: NotificationType.SYSTEM,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.DELIVERED,
        subject,
        content,
        recipient: 'all',
        sentAt: new Date(),
        deliveredAt: new Date(),
      }),
    );

    this.realtimeService.broadcastToAll('notification-created', {
      id: notification.id,
      type: notification.type,
      subject: notification.subject,
      content: notification.content,
      createdAt: notification.createdAt,
    });

    return { notified: true, channel: 'in_app', notificationId: notification.id };
  }

  private async sendWebhook(
    node: WorkflowNode,
    subject: string,
    content: string,
    input: unknown,
  ) {
    const url = String(node.data?.webhookUrl || '').trim();
    if (!url) {
      return { notified: false, reason: 'webhookUrl not configured' };
    }

    const body = { subject, content, data: input, timestamp: new Date().toISOString() };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return {
        notified: response.ok,
        channel: 'webhook',
        status: response.status,
        ok: response.ok,
      };
    } catch (err) {
      return {
        notified: false,
        channel: 'webhook',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
