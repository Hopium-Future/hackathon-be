import {
  EventPattern,
  MessagePattern,
  Payload,
  Transport,
} from '@nestjs/microservices';

import {
  Controller,
  Logger,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { EmitDto, EmitToUserDto } from './dto/socket.dto';
import { SocketStreamGateway } from './socket-stream.gateway';

@Controller()
export class SocketStreamController {
  private readonly logger = new Logger(SocketStreamController.name);
  constructor(private readonly socketGateway: SocketStreamGateway) {}

  // @UseFilters(new ExceptionFilter())
  // @UsePipes(new ValidationPipe())
  @EventPattern('socket:emit:user', Transport.REDIS)
  async emitToUser(
    @Payload()
    payload: EmitToUserDto,
  ) {
    if (!payload.userId || !payload.event) {
      this.logger.warn('socket:emit:user - invalid payload', payload);
    }
    this.socketGateway.emitToUser(payload);
  }

  // @UseFilters(new ExceptionFilter())
  // @UsePipes(new ValidationPipe())
  @EventPattern('socket:emit', Transport.REDIS)
  async emit(
    @Payload()
    payload: EmitDto,
  ) {
    if (!payload.event) {
      this.logger.warn('socket:emit - invalid payload', payload);
    }

    this.socketGateway.emit(payload);
  }
}
