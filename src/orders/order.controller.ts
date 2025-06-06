import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ORDER_EVENTS } from './constants/events';
import { OrderCreatedPayload } from './type/order.type';
import {
  OrderClosedPayload,
  OrderUpdatedPayload,
} from 'src/tasks/type/order.type';
import { CHATBOT_EVENTS } from '../chatbot/constants/events';
import { OrderService } from './order.service';

@Controller('orders')
export class OrderController {
  private readonly logger = new Logger(OrderController.name);
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly orderService: OrderService,
    ) {}

  @MessagePattern(ORDER_EVENTS.CREATED, Transport.KAFKA)
  async onOrderCreated(@Payload() payload: OrderCreatedPayload) {
    if (
      !payload ||
      !payload.user_id ||
      !payload.displaying_id ||
      !payload.order_value
    ) {
      this.logger.error('Invalid payload', payload);
      return;
    }

    this.eventEmitter.emit(ORDER_EVENTS.CREATED, payload);
  }

  @MessagePattern(ORDER_EVENTS.UPDATED, Transport.KAFKA)
  async onOrderUpdated(@Payload() payload: OrderUpdatedPayload) {
    if (
      !payload ||
      !payload.user_id ||
      !payload.displaying_id ||
      !payload.order_value
    ) {
      this.logger.error('Invalid payload', payload);
      return;
    }

    this.eventEmitter.emit(ORDER_EVENTS.UPDATED, payload);
  }

  @MessagePattern(ORDER_EVENTS.CLOSED, Transport.KAFKA)
  async onOrderClosed(@Payload() payload: OrderClosedPayload) {
    if (
      !payload ||
      !payload.user_id ||
      !payload.displaying_id ||
      !payload.order_value
    ) {
      this.logger.error('Invalid payload', payload);
      return;
    }

    this.eventEmitter.emit(ORDER_EVENTS.CLOSED, payload);
  }

  @MessagePattern(CHATBOT_EVENTS.USER_POSITION, Transport.KAFKA)
  async getUserPosition(@Payload() payload: { user_id: number, status: number }) {
    if (
      !payload ||
      !payload.user_id ||
      !payload.status
    ) {
      this.logger.error('Invalid payload', payload);
      return;
    }

    return await this.orderService.getUserPosition(payload.user_id, payload.status);
  }
}
