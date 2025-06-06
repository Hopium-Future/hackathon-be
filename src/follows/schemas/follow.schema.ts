import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FollowDocument = HydratedDocument<Follow>;

@Schema({
  timestamps: true,
  collection: 'follows',
})
export class Follow {
  @Prop({
    type: Number,
    required: true,
    isInteger: true,
    index: true,
  })
  followerId: number;

  @Prop({
    type: Number,
    required: true,
    isInteger: true,
  })
  followingId: number;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);

FollowSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
