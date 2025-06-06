import { Prop, Schema, SchemaFactory, Virtual } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { FutureOrder } from 'src/orders/schemas/future-order.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { PostStatus } from '../constants/posts';

export type PostDocument = HydratedDocument<Post>;

@Schema({
  _id: false,
})
class Engagement {
  @Prop({
    type: Number,
    default: 0,
    isInteger: true,
  })
  stars: number;

  @Prop({
    type: Number,
    default: 0,
    isInteger: true,
  })
  copies: number;

  @Prop({
    type: Number,
    default: 0,
    isInteger: true,
  })
  counters: number;

  @Prop({
    type: Number,
    default: 0,
    isInteger: true,
  })
  shares: number;
}

@Schema({
  timestamps: true,
  collection: 'posts',
  toObject: { virtuals: true },
  toJSON: { virtuals: true },
})
export class Post {
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
    unique: true,
  })
  orderId: number; // futuresorder - displaying_id

  @Prop({
    type: String,
  })
  caption?: string;

  @Prop({
    type: String,
    required: true,
  })
  symbol: string;

  @Prop({
    type: String,
    required: true,
  })
  side: string;

  @Prop({
    type: Number,
    enum: PostStatus,
    required: true,
    default: 1,
  })
  status: number;

  @Prop({
    type: Number,
    required: true,
    default: 0,
  })
  profit: number;

  @Prop(Engagement)
  engagement: Engagement;

  @Prop({
    type: Object,
    default: {},
  })
  reactions: {
    like: number;
    dislike: number;
  };

  @Virtual({
    options: {
      ref: User.name,
      localField: 'userId',
      foreignField: '_id',
      justOne: true,
    },
  })
  user?: User;

  @Virtual({
    options: {
      ref: FutureOrder.name,
      localField: 'orderId',
      foreignField: 'displaying_id',
      justOne: true,
    },
  })
  futureOrder?: FutureOrder;

  @Prop({
    type: Object,
    default: {},
  })
  invoiceLinks?: Record<string, string>; // Mapping amount vs invoice link

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PostSchema = SchemaFactory.createForClass(Post);
