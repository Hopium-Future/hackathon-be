import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
// import { AuthService } from 'src/auth/auth.service';
import { Logger } from '@nestjs/common';
import { EmitDto, EmitToUserDto } from './dto/socket.dto';

@WebSocketGateway({
  path: '/ws',
  // namespace: 'ws',
  cors: {
    origin: '*',
  },
})
export class SocketStreamGateway implements OnGatewayInit {
  private readonly logger = new Logger(SocketStreamGateway.name);
  @WebSocketServer() server: Server;

  constructor() {}

  afterInit() {
    this.logger.log('Socket stream initialized');

    // this.initTest();
  }

  private getUserRoom(userId: number) {
    return `user_${userId}`;
  }

  emit(payload: EmitDto) {
    // this.logger.log('Emitting', payload);
    // Broadcast to specific channel
    if (payload.channel) {
      return this.server
        .to(payload.channel.toLowerCase())
        .emit(payload.event, payload.data);
    }

    // Broadcast to all connected clients
    return this.server.emit(payload.event, payload.data);
  }

  emitToUser(payload: EmitToUserDto) {
    const userChannel = this.getUserRoom(payload.userId);
    // Broadcast to user channel and specific channel
    if (payload.channel) {
      const channel = payload.channel.toLowerCase();
      return this.server
        .in(userChannel)
        .fetchSockets()
        .then((sockets) => {
          sockets.forEach((socket) => {
            if (socket.rooms.has(channel)) {
              socket.emit(payload.event, payload.data);
            }
          });
        });
    }

    // Broadcast to user channel
    return this.server.to(userChannel).emit(payload.event, payload.data);
  }
}
