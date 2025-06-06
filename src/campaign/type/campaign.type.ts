import {
  OrderClosedPayload,
  OrderCreatedPayload,
} from 'src/tasks/type/order.type';

export enum Status {
  UPCOMING = 0,
  ONGOING = 1,
  COMPLETED = 2,
}

export enum Condition {
  TOP_VOLUME_TRADE = 'TOP_VOLUME_TRADE',
  TOP_HIGHEST_VOLUME = 'TOP_HIGHEST_VOLUME',
  TOP_PNL = 'TOP_PNL',
}

export type Metadata = {
  orderId?: number;
  volume?: number;
};

export type EventData = {
  order?: OrderCreatedPayload;
  orderClosed?: OrderClosedPayload;
};
