import { INestApplication, Logger } from '@nestjs/common';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { KafkaConfig } from './configuration/config.interface';

export default function (app: INestApplication, kafkaConfig: KafkaConfig) {
  const logger = new Logger();

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: kafkaConfig.brokers,
      },
      consumer: {
        groupId: kafkaConfig.consumerGroupId,
      },
    },
  });

  logger.log(`Kafka start`);
  logger.log(`==========================================================`);
}
