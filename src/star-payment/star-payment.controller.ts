import { Controller, Logger } from '@nestjs/common';
import { StarPaymentService } from './star-payment.service';
import { MessagePattern, Transport } from '@nestjs/microservices';
import {
  PreCheckoutQueryPayload,
  SuccessfulPaymentPayload,
} from './type/payment.type';

@Controller('star-payment')
export class StarPaymentController {
  private readonly logger = new Logger(StarPaymentController.name);
  constructor(private readonly starPaymentService: StarPaymentService) {}

  @MessagePattern('invoice.pre_checkout_query', Transport.KAFKA)
  onPreCheckoutQuery(data: PreCheckoutQueryPayload) {
    this.logger.log(`Received pre_checkout_query: `, data);
    this.starPaymentService.onPreCheckoutQuery(data);
  }

  @MessagePattern('invoice.successful_payment', Transport.KAFKA)
  async onSuccessfulPayment(data: SuccessfulPaymentPayload) {
    this.logger.log(`Received successful_payment: `, data);
    await this.starPaymentService.onSuccessfulPayment(data);
  }
}
