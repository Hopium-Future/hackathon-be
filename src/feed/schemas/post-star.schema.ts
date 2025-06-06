import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PostStarDocument = HydratedDocument<PostStar>;

export enum PostStarTransferCallerStatus {
  NEW = 'NEW',
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

@Schema({
  timestamps: true,
  collection: 'post_stars',
})
export class PostStar {
  @Prop({
    type: Number,
    required: true,
    isInteger: true,
    index: true,
  })
  userId: number;

  @Prop({
    type: Types.ObjectId,
    required: true,
  })
  postId: Types.ObjectId;

  @Prop({
    type: Number,
    isInteger: true,
  })
  postAuthorId?: number;

  @Prop({
    type: Number,
    required: true,
    min: 1,
  })
  amount: number;

  @Prop({
    type: Types.ObjectId,
    required: true,
  })
  transactionId: Types.ObjectId;

  @Prop({
    type: Number,
  })
  callerReceivedAmount?: number;

  @Prop({
    type: Number,
  })
  callerReceivedAssetId?: number;

  @Prop({
    type: String,
  })
  transferCallerId?: string;

  @Prop({
    type: String,
    enum: Object.values(PostStarTransferCallerStatus),
    default: PostStarTransferCallerStatus.NEW,
  })
  transferCallerStatus: PostStarTransferCallerStatus;

  @Prop({
    type: String,
  })
  transferErrorMessage?: string;

  @Prop({
    type: Object,
  })
  metadata?: Record<string, any>;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PostStarSchema = SchemaFactory.createForClass(PostStar);
