import { Module } from '@nestjs/common';
import { SocketStreamController } from './socket-stream.controller';
import { SocketStreamGateway } from './socket-stream.gateway';

@Module({
  controllers: [SocketStreamController],
  providers: [SocketStreamGateway],
})
export class SocketStreamModule {}
