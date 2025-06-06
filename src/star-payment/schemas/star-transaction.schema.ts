import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StarTransactionDocument = HydratedDocument<StarTransaction>;
// export enum StarTransactionStatus {
//   PRE_CHECKOUT = 'pre_checkout',
//   SUCCESS = 'success',
// }

@Schema({
  timestamps: true,
  collection: 'star_transactions',
})
export class StarTransaction {
  @Prop({
    type: Number,
    isInteger: true,
  })
  userId?: number;

  @Prop({
    type: Number,
    required: true,
    isInteger: true,
  })
  telegramUserId: number;

  @Prop({
    type: String,
    trim: true,
  })
  username?: string;

  @Prop({
    type: String,
    required: true,
  })
  currency: string;

  @Prop({
    type: Number,
    required: true,
  })
  totalAmount: number;

  @Prop({
    type: Object,
  })
  invoicePayload?: Record<string, any>;

  //   @Prop({
  //     type: String,
  //     required: true,
  //     enum: Object.values(StarTransactionStatus),
  //   })
  //   status: StarTransactionStatus;

  @Prop({
    type: String,
  })
  telegramPaymentChargeId?: string;

  @Prop({
    type: String,
  })
  providerPaymentChargeId?: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const StarTransactionSchema =
  SchemaFactory.createForClass(StarTransaction);
