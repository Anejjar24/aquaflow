import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  BaseWsExceptionFilter,
} from '@nestjs/websockets';
import { Logger, UseFilters, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      // Extract token from socket.io auth
      const token = client.handshake.auth?.token as string;
      if (!token) {
        this.logger.warn(`Client connection rejected: no token provided (socket: ${client.id})`);
        client.disconnect(true);
        return;
      }

      // Validate JWT token
      const secret = this.configService.get('JWT_SECRET') || 'your-secret-key';
      const payload = this.jwtService.verify(token, { secret });
      const userId = payload.sub;

      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
      this.realtimeService.addConnection(client.id, client, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Client connection rejected: invalid token (socket: ${client.id}, reason: ${message})`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.realtimeService.getUserIdByClientId(client.id);
    this.logger.log(`Client disconnected: ${client.id} (User: ${userId})`);
    this.realtimeService.removeConnection(client.id);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ) {
    const { channel } = data;
    client.join(`channel:${channel}`);
    this.logger.debug(`Client ${client.id} subscribed to ${channel}`);
    return { status: 'subscribed', channel };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channel: string },
  ) {
    const { channel } = data;
    client.leave(`channel:${channel}`);
    this.logger.debug(`Client ${client.id} unsubscribed from ${channel}`);
    return { status: 'unsubscribed', channel };
  }

  @SubscribeMessage('ping')
  handlePing(): { pong: number } {
    return { pong: Date.now() };
  }
}
