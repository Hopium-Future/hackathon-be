import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { OrderStatus } from '../constants/order';

export type FutureOrderDocument = FutureOrder & Document;

@Schema({ collection: 'futureorders' })
export class FutureOrder {
  @Prop()
  displaying_id: number;

  @Prop()
  user_id: number;

  @Prop({
    type: Number,
    enum: OrderStatus,
    required: true,
    default: 0,
  })
  status: number;

  @Prop()
  side: string;

  @Prop()
  type: string;

  @Prop()
  symbol: string;

  @Prop()
  price: number;

  @Prop()
  quantity: number;

  @Prop()
  leverage: number;

  @Prop()
  sl: number;

  @Prop()
  tp: number;

  @Prop()
  fee: number;

  @Prop()
  fee_currency: number;

  @Prop()
  profit: number;

  @Prop()
  raw_profit: number;

  @Prop()
  margin: number;

  @Prop()
  margin_currency: number;

  @Prop()
  order_value: number;

  @Prop()
  close_order_value: number;

  @Prop()
  order_value_currency: number;

  @Prop()
  close_order_value_currency: number;

  @Prop()
  maintenance_margin: number;

  @Prop()
  open_price: number;

  @Prop({ type: Date })
  opened_at: Date;

  @Prop()
  close_price: number;

  @Prop({ type: Date })
  closed_at: Date;

  @Prop({ type: Date })
  createdAt: Date;
}

export const FutureOrderSchema = SchemaFactory.createForClass(FutureOrder);
