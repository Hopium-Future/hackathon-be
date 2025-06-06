import { Module } from '@nestjs/common';
import { StarPaymentService } from './star-payment.service';
import { StarPaymentController } from './star-payment.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { KafkaConfig } from 'src/configuration/config.interface';
import { MongooseModule } from '@nestjs/mongoose';
import {
  StarTransaction,
  StarTransactionSchema,
} from './schemas/star-transaction.schema';
import { UsersModule } from 'src/users/users.module';
import { KafkaClientModule } from 'src/kafka-client/kafka-client.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StarTransaction.name, schema: StarTransactionSchema },
    ]),
    KafkaClientModule,
    UsersModule,
  ],
  controllers: [StarPaymentController],
  providers: [StarPaymentService],
  exports: [StarPaymentService],
})
export class StarPaymentModule {}
