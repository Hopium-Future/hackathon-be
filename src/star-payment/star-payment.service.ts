import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import {
  CreateInvoiceLinkPayload,
  PreCheckoutQueryPayload,
  SuccessfulPaymentPayload,
} from './type/payment.type';
import { firstValueFrom } from 'rxjs';
import { InjectModel } from '@nestjs/mongoose';
import { StarTransaction } from './schemas/star-transaction.schema';
import { Model } from 'mongoose';
import { UsersService } from 'src/users/users.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { STAR_PAYMENT_EVENT } from './constants/events';
import { KafkaClientService } from 'src/kafka-client/kafka-client.service';

@Injectable()
export class StarPaymentService implements OnModuleInit {
  private readonly logger = new Logger(StarPaymentService.name);
  constructor(
    private readonly kafkaClient: KafkaClientService,
    @InjectModel(StarTransaction.name)
    private readonly starTransactionModel: Model<StarTransaction>,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    // this.kafkaClient.subscribeToResponseOf('invoice.create_link');
  }

  onPreCheckoutQuery(data: PreCheckoutQueryPayload) {
    this.kafkaClient.emit('invoice.answer_pre_checkout_query', {
      preCheckoutQueryId: data.id,
      ok: true,
      errorMessage: undefined,
    });
  }

  async onSuccessfulPayment(data: SuccessfulPaymentPayload) {
    try {
      const user = await this.usersService.getUserByTelegramIdCached(
        data.from.id,
      );
      const invoicePayload = data.successful_payment.invoice_payload;
      const transaction = await this.starTransactionModel.create({
        userId: user?._id,
        telegramUserId: data.from.id,
        totalAmount: data.successful_payment.total_amount,
        currency: data.successful_payment.currency,
        telegramPaymentChargeId:
          data.successful_payment.telegram_payment_charge_id,
        providerPaymentChargeId:
          data.successful_payment.provider_payment_charge_id,
        invoicePayload: invoicePayload,
        username: user?.username ?? data.from.username,
      });

      this.eventEmitter.emit(
        STAR_PAYMENT_EVENT.SUCCESSFUL_PAYMENT,
        transaction,
      );
    } catch (error) {
      this.logger.error('Error onSuccessfulPayment:', error);
    }
  }

  async createInvoiceLink(data: CreateInvoiceLinkPayload) {
    const result = await firstValueFrom(
      this.kafkaClient.send<{ invoiceLink: string }>(
        'invoice.create_link',
        data,
      ),
    );
    return result.invoiceLink;
  }
}
