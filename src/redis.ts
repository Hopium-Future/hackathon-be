import { INestApplication, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { RedisPubSubConfig } from './configuration/config.interface';

export default function (
  app: INestApplication,
  redisConfig: RedisPubSubConfig,
) {
  const logger = new Logger();
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.REDIS,
    options: {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      username: redisConfig.username,
      password: redisConfig.password,
    },
  });

  logger.log(`REDIS Microservice start`);
  logger.log(`==========================================================`);
}
