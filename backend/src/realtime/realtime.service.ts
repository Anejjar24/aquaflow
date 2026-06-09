import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private connections: Map<string, Socket> = new Map();
  private userConnections: Map<string, string[]> = new Map(); // userId -> clientIds

  addConnection(clientId: string, socket: Socket, userId: string) {
    this.connections.set(clientId, socket);
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, []);
    }
    this.userConnections.get(userId)?.push(clientId);
    this.logger.debug(
      `Connection added: ${clientId} for user ${userId}. Total: ${this.connections.size}`,
    );
  }

  removeConnection(clientId: string) {
    const socket = this.connections.get(clientId);
    if (socket) {
      this.connections.delete(clientId);
      // Remove from user connections
      for (const [userId, clientIds] of this.userConnections.entries()) {
        const index = clientIds.indexOf(clientId);
        if (index > -1) {
          clientIds.splice(index, 1);
          if (clientIds.length === 0) {
            this.userConnections.delete(userId);
          }
          break;
        }
      }
      this.logger.debug(
        `Connection removed: ${clientId}. Total: ${this.connections.size}`,
      );
    }
  }

  getUserIdByClientId(clientId: string): string | null {
    for (const [userId, clientIds] of this.userConnections.entries()) {
      if (clientIds.includes(clientId)) {
        return userId;
      }
    }
    return null;
  }

  broadcastToAll(event: string, data: any) {
    this.connections.forEach((socket) => {
      socket.emit(event, data);
    });
    this.logger.debug(`Broadcast to all: ${event}`);
  }

  broadcastToRoom(room: string, event: string, data: any) {
    this.connections.forEach((socket) => {
      if (socket.rooms.has(room)) {
        socket.emit(event, data);
      }
    });
    this.logger.debug(`Broadcast to room ${room}: ${event}`);
  }

  broadcastToUser(userId: string, event: string, data: any) {
    const clientIds = this.userConnections.get(userId);
    if (clientIds) {
      clientIds.forEach((clientId) => {
        const socket = this.connections.get(clientId);
        if (socket) {
          socket.emit(event, data);
        }
      });
      this.logger.debug(`Broadcast to user ${userId}: ${event}`);
    }
  }

  emitToClient(clientId: string, event: string, data: any) {
    const socket = this.connections.get(clientId);
    if (socket) {
      socket.emit(event, data);
      this.logger.debug(`Emit to client ${clientId}: ${event}`);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getActiveUsers(): number {
    return this.userConnections.size;
  }
}
