import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PostOrderDocument = HydratedDocument<PostOrder>;

@Schema({
  timestamps: true,
  collection: 'post_orders',
})
export class PostOrder {
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
    required: true,
    isInteger: true,
    index: true,
  })
  followOrderId: number;

  @Prop({
    type: String,
    required: true,
  })
  side: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PostOrderSchema = SchemaFactory.createForClass(PostOrder);
