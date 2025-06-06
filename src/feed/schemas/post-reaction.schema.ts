import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Reactions } from '../constants/reactions';

export type PostReactionDocument = HydratedDocument<PostReaction>;

@Schema({
  timestamps: true,
  collection: 'post_reactions',
})
export class PostReaction {
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
    type: String,
    required: true,
    enum: Object.values(Reactions),
  })
  reaction: string;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const PostReactionSchema = SchemaFactory.createForClass(PostReaction);

PostReactionSchema.index(
  { userId: 1, postId: 1, reaction: 1 },
  { unique: true },
);
