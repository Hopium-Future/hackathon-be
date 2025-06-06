import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Reward } from './partners.schema';

export type UserPartnerLogDocument = HydratedDocument<UserPartnerLog>;

@Schema({
  timestamps: true,
  collection: 'users_partners_log',
})
export class UserPartnerLog {
  @Prop({
    type: Number,
    required: true,
  })
  userId: number;

  @Prop({
    type: Number,
    required: true,
  })
  partnerId: number;

  @Prop({
    type: String,
    required: true,
  })
  action: string;

  @Prop({
    type: Object,
    required: false,
  })
  metadata?: {
    rewards?: Reward[];
  };
}

export const UserPartnerLogSchema =
  SchemaFactory.createForClass(UserPartnerLog);
UserPartnerLogSchema.index({ userId: 1, partnerId: 1 });
