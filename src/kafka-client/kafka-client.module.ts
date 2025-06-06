import { Module } from '@nestjs/common';
import { KafkaClientService } from './kafka-client.service';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { KafkaConfig } from 'src/configuration/config.interface';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        useFactory: async (configService: ConfigService) => {
          const kafkaConfig = configService.get<KafkaConfig>('kafka');
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                brokers: kafkaConfig.brokers,
              },
              consumer: {
                groupId: kafkaConfig.consumerGroupId,
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KafkaClientService],
  exports: [KafkaClientService],
})
export class KafkaClientModule {}
