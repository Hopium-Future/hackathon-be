import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({
  collection: 'futuresorderlogs',
})
export class FutureOrderLog extends Document {
  @Prop()
  orderId: number;

  @Prop()
  type: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop({ type: Date })
  createdTime: Date;

  @Prop({ type: Date })
  updatedTime: Date;
}

export const FutureOrderLogSchema =
  SchemaFactory.createForClass(FutureOrderLog);
