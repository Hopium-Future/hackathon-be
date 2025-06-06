import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type DepositwithdrawDocument = HydratedDocument<Depositwithdraw>;

@Schema({
  collection: 'depositwithdraws',
})
export class Depositwithdraw {
  @Prop({
    type: Number,
    required: true,
  })
  type: number;

  @Prop({
    type: Number,
    required: true,
  })
  status: number;

  @Prop({
    type: Number,
    required: true,
  })
  userId: number;

  @Prop({
    type: Number,
    required: false,
  })
  usdValue: number;

  @Prop({
    type: Number,
    required: false,
  })
  amount: number;

  @Prop({
    type: Number,
    required: false,
  })
  assetId: number;

  @Prop({
    type: Date,
    required: true,
  })
  createdAt: Date;
}

export const DepositwithdrawSchema = SchemaFactory.createForClass(Depositwithdraw);
