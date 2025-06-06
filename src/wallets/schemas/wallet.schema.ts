import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Asset } from '../constants/common';

export type WalletDocument = HydratedDocument<Wallet>;

@Schema({
  timestamps: true,
  collection: 'wallets',
})
export class Wallet {
  @Prop({
    type: Number,
    required: true,
    index: true,
  })
  userId: number; // Telegram user ID

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  balance: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  locked: number;

  @Prop({
    type: Number,
    required: true,
    default: Asset.HOPIUM,
  })
  assetId: number;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
WalletSchema.index({ userId: 1, assetId: 1 }, { unique: true });
