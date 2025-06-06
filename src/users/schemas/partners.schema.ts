import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type PartnerDocument = HydratedDocument<Partner>;

export type Reward = {
  assetId: number;
  assetQuantity: number;
};

@Schema({
  timestamps: true,
  collection: 'partners',
})
export class Partner {
  @Prop({
    type: Number,
    required: true,
  })
  _id: number;

  @Prop({
    type: String,
    required: true,
  })
  name: string;

  @Prop({
    type: Object,
    required: false,
  })
  metadata?: {
    accumulatedVolume?: number;
    rewards?: Reward[];
  };
}

export const PartnerSchema = SchemaFactory.createForClass(Partner);
