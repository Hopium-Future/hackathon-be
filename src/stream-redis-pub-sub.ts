import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { Config, RedisPubSubConfig } from './configuration/config.interface';
import { RedisIoAdapter } from './commons/adapters/redis-io.adapter';
import redisInit from './redis';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from './configuration/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { SocketStreamModule } from './socket-stream/socket-stream.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    SocketStreamModule,
  ],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: true,
    }),
  );
  const configService = app.get(ConfigService<Config>);

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connectToRedis(configService.get('redisUri'));

  app.useWebSocketAdapter(redisIoAdapter);

  const logger = new Logger('bootstrap');

  const redisConfig = configService.get<RedisPubSubConfig>('redisPubSub');

  redisInit(app, redisConfig);

  await app.startAllMicroservices();

  const port = configService.get('port');
  await app.listen(1 + port, '0.0.0.0').then(() => {
    logger.log(`Server pub/sub stream started on http://localhost:${port + 1}`);
  });
}
bootstrap();
