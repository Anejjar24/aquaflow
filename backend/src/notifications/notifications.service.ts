import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Or, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Alert, AlertSeverity } from '../database/entities/Alert.entity';
import { Notification, NotificationChannel, NotificationStatus, NotificationType } from '../database/entities/Notification.entity';
import { Sensor } from '../database/entities/Sensor.entity';
import { Station } from '../database/entities/Station.entity';
import { User, UserRole } from '../database/entities/User.entity';
import { RealtimeService } from '../realtime/realtime.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly realtimeService: RealtimeService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Triggered by AlertsService ──────────────────────────────────────────

  async notifyAlertCreated(
    alert: Alert,
    station?: Station | null,
    sensor?: Sensor | null,
  ): Promise<void> {
    const subject = `[AquaFlow] ${alert.severity.toUpperCase()} Alert: ${alert.message}`;
    const content = this.buildAlertContent(alert, station, sensor);

    // 1. Create one broadcast in-app notification (user = null → visible to all)
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        type: NotificationType.ALERT,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.DELIVERED,
        subject,
        content,
        recipient: 'all',
        alert,
        sentAt: new Date(),
        deliveredAt: new Date(),
      }),
    );

    // 2. Broadcast via WebSocket to all connected users
    this.realtimeService.broadcastToAll('notification-created', {
      id: notification.id,
      type: notification.type,
      subject: notification.subject,
      content: notification.content,
      severity: alert.severity,
      alertId: alert.id,
      stationId: station?.id ?? null,
      sensorId: sensor?.id ?? null,
      createdAt: notification.createdAt,
    });

    // 3. Send email to all active admins if severity = critical AND SMTP configured
    if (alert.severity === AlertSeverity.CRITICAL) {
      await this.sendEmailToAdmins(subject, content, alert).catch((err) =>
        this.logger.warn(`Email delivery failed: ${err.message}`),
      );
    }
  }

  // ─── API methods ──────────────────────────────────────────────────────────

  async findAll(query: NotificationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.alert', 'alert')
      .where('n.recipient = :all', { all: 'all' })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.unreadOnly) {
      qb.andWhere('n.readAt IS NULL');
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } };
  }

  async getUnreadCount(): Promise<{ count: number }> {
    const count = await this.notificationRepo
      .createQueryBuilder('n')
      .where('n.recipient = :all', { all: 'all' })
      .andWhere('n.readAt IS NULL')
      .getCount();
    return { count };
  }

  async markRead(id: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({ where: { id } });
    if (!notification) throw new NotFoundException(`Notification ${id} not found`);

    notification.status = NotificationStatus.READ;
    notification.readAt = new Date();
    return this.notificationRepo.save(notification);
  }

  async markAllRead(): Promise<{ updated: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ status: NotificationStatus.READ, readAt: new Date() })
      .where('recipient = :all', { all: 'all' })
      .andWhere('readAt IS NULL')
      .execute();

    // Broadcast unread count reset
    this.realtimeService.broadcastToAll('notifications-read-all', { count: 0 });
    return { updated: result.affected ?? 0 };
  }

  // ─── Email helpers ────────────────────────────────────────────────────────

  private async sendEmailToAdmins(subject: string, content: string, alert: Alert): Promise<void> {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    if (!smtpHost) {
      this.logger.debug('SMTP not configured — skipping email notification');
      return;
    }

    const admins = await this.userRepo.find({
      where: { role: UserRole.ADMIN, isActive: true },
    });

    if (!admins.length) return;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: this.configService.get<number>('SMTP_PORT') ?? 587,
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });

    const from = this.configService.get<string>('SMTP_FROM') || 'noreply@aquaflow.io';

    for (const admin of admins) {
      try {
        await transporter.sendMail({
          from,
          to: admin.email,
          subject,
          html: `<p>${content.replace(/\n/g, '<br>')}</p>`,
        });

        // Record email delivery
        await this.notificationRepo.save(
          this.notificationRepo.create({
            type: NotificationType.ALERT,
            channel: NotificationChannel.EMAIL,
            status: NotificationStatus.SENT,
            subject,
            content,
            recipient: admin.email,
            user: admin,
            alert,
            sentAt: new Date(),
          }),
        );
        this.logger.log(`Alert email sent to ${admin.email}`);
      } catch (err) {
        this.logger.warn(`Failed to send email to ${admin.email}: ${(err as Error).message}`);

        await this.notificationRepo.save(
          this.notificationRepo.create({
            type: NotificationType.ALERT,
            channel: NotificationChannel.EMAIL,
            status: NotificationStatus.FAILED,
            subject,
            content,
            recipient: admin.email,
            user: admin,
            alert,
            failureReason: (err as Error).message,
          }),
        );
      }
    }
  }

  private buildAlertContent(
    alert: Alert,
    station?: Station | null,
    sensor?: Sensor | null,
  ): string {
    const lines = [
      `Severity: ${alert.severity.toUpperCase()}`,
      `Type: ${alert.type}`,
      `Message: ${alert.message}`,
    ];
    if (alert.description) lines.push(`Details: ${alert.description}`);
    if (station) lines.push(`Station: ${station.name}`);
    if (sensor) lines.push(`Sensor: ${sensor.name} (${sensor.unit})`);
    lines.push(`Time: ${new Date().toISOString()}`);
    return lines.join('\n');
  }
}
