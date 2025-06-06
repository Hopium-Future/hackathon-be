import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LeaderboardHistoryDocument = HydratedDocument<LeaderboardHistory>;

@Schema({
  collection: 'leaderboard_histories',
})
export class LeaderboardHistory {
  @Prop({
    type: Number,
    required: true,
    isInteger: true,
    index: true,
  })
  userId: number;

  @Prop({
    type: Number,
    required: true,
    isInteger: true,
    index: true,
  })
  orderId: number;

  @Prop({
    type: Number,
    required: false,
    isInteger: true,
  })
  copyCounterOrderId?: number;

  @Prop({
    type: Number,
    required: true,
  })
  margin: number;

  @Prop({
    type: Number,
    required: true,
  })
  leverage: number;

  @Prop({
    type: Number,
    required: true,
  })
  profit: number;

  @Prop({
    type: Number,
    required: true,
  })
  rawProfit: number;

  @Prop({
    type: Number,
    required: true,
  })
  volume: number;

  @Prop({
    type: Number,
    required: true,
  })
  closeVolume: number;

  @Prop()
  openedAt?: Date;

  @Prop()
  closedAt?: Date;
}

export const LeaderboardHistorySchema =
  SchemaFactory.createForClass(LeaderboardHistory);

LeaderboardHistorySchema.index({ userId: 1, orderId: 1 }, { unique: true });
