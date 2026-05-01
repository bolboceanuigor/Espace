import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

const ORG_ROOM_PREFIX = 'organization:';

function extractTokenFromCookie(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';').map((chunk) => chunk.trim());
  const accessCookie = parts.find((chunk) => chunk.startsWith('accessToken='));
  if (!accessCookie) return undefined;
  return accessCookie.slice('accessToken='.length) || undefined;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL,
    credentials: true,
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

  afterInit(_server: Server) {}

  handleConnection(client: Socket) {
    const tokenFromAuth =
      client.handshake.auth && typeof client.handshake.auth === 'object' && 'token' in client.handshake.auth
        ? (client.handshake.auth as { token?: string }).token
        : undefined;
    const tokenFromCookie = extractTokenFromCookie(client.handshake.headers?.cookie);
    const token = tokenFromAuth || tokenFromCookie;

    if (!token) {
      client.disconnect(true);
      return;
    }

    let payload: { organizationId?: string | null };
    try {
      payload = this.jwtService.verify(token);
    } catch {
      client.disconnect(true);
      return;
    }

    const organizationId = payload?.organizationId;
    if (!organizationId || typeof organizationId !== 'string') {
      client.disconnect(true);
      return;
    }

    const room = `${ORG_ROOM_PREFIX}${organizationId}`;
    client.join(room);
    this.logger.log(
      `Client ${client.id} joined room ${room} (org ${organizationId})`,
    );
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Emit an event only to sockets in the given organization's room.
   */
  emitToOrganization(
    organizationId: string,
    event: string,
    data: unknown,
  ): void {
    const room = `${ORG_ROOM_PREFIX}${organizationId}`;
    this.server.to(room).emit(event, data);
  }
}
