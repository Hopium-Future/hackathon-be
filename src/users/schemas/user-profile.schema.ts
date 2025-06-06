import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Reward } from './partners.schema';

export type UserProfileDocument = HydratedDocument<UserProfile>;

@Schema({
  timestamps: true,
  collection: 'users_profiles',
})
export class UserProfile {
  @Prop({
    type: Number,
    required: true,
  })
  userId: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  winRate7d?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  profit7d?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  volume7d?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  roi7d?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  winRate30d?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  profit30d?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  volume30d?: number;

  @Prop({
    type: Number,
    required: false,
    default: 0,
  })
  roi30d?: number;
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
UserProfileSchema.index({ userId: 1, partnerId: 1 });
