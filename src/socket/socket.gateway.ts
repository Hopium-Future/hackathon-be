import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
// import { AuthService } from 'src/auth/auth.service';
import { Logger } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { isArray, isObject, isString } from 'class-validator';
import { EmitToUserDto } from 'src/socket-stream/dto/socket.dto';

@WebSocketGateway({
  path: '/ws',
  // namespace: 'ws',
  cors: {
    origin: '*',
  },
})
export class SocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SocketGateway.name);
  @WebSocketServer() server: Server;

  constructor(private readonly authService: AuthService) {}

  afterInit() {
    this.logger.log('Socket initialized');
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong' };
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, data: any) {
    if (!data) {
      return;
    }
    if (isString(data)) {
      // Join single channel eg. emit('subscribe', 'channel')
      this.handleJoinChannel(client, data);
    } else if (isArray(data) && isString(data[0])) {
      // Join multiple channels eg. emit('subscribe', ['channel1', 'channel2'])
      data.forEach((channel) => this.handleJoinChannel(client, channel));
    } else if (isObject<any>(data) && isString(data.channel)) {
      if (data.params && isArray(data.params)) {
        // Join channel with params eg. emit('subscribe', { channel: 'channel', params: ['param1', 'param2'] })
        data.params.forEach((param) =>
          this.handleJoinChannel(client, `${data.channel}:${param}`),
        );
      } else {
        // Join channel eg. emit('subscribe', { channel: 'channel' })
        this.handleJoinChannel(client, data.channel);
      }
    }
  }
  handleJoinChannel(client: Socket, chanel: string) {
    client.join(chanel.toLowerCase());
  }

  handleLeaveChannel(client: Socket, chanel: string) {
    client.leave(chanel.toLowerCase());
  }

  @SubscribeMessage('unsubscribe')
  handleUnSubscribe(client: Socket, data: any) {
    if (!data) {
      return;
    }

    if (isString(data)) {
      // Leave single channel eg. emit('unsubscribe', 'channel')
      this.handleLeaveChannel(client, data);
    } else if (isArray(data) && isString(data[0])) {
      // Leave multiple channels eg. emit('unsubscribe', ['channel1', 'channel2'])
      data.forEach((channel) => this.handleLeaveChannel(client, channel));
    } else if (isObject<any>(data) && isString(data.channel)) {
      if (data.params && isArray(data.params)) {
        // Leave channel with params eg. emit('unsubscribe', { channel: 'channel', params: ['param1', 'param2'] })
        data.params.forEach((param) =>
          this.handleLeaveChannel(client, `${data.channel}:${param}`),
        );
      } else {
        // Leave channel eg. emit('unsubscribe', { channel: 'channel' })
        this.handleLeaveChannel(client, data.channel);
      }
    }
  }

  private getUserRoom(userId: number) {
    return `user_${userId}`;
  }

  handleConnection(client: Socket) {
    const authHeader = client.handshake.headers['x-auth-user'];
    if (!!authHeader) {
      try {
        const user = this.authService.parseUserFromHeader(authHeader as string);
        client.data.user = user;
        if (user.id) {
          client.join(this.getUserRoom(user.id));
          client.emit('connected', { user });
        }
      } catch (error) {
        console.error('Unauthorized user Error', error.message);
      }
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.user?.id) {
      client.leave(this.getUserRoom(client.data.user.id));
    }
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

      // return this.server
      //   .in([userChannel, payload.channel.toLowerCase()])
      //   .emit(payload.event, payload.data);
    }

    // Broadcast to user channel
    return this.server.to(userChannel).emit(payload.event, payload.data);
  }
}
