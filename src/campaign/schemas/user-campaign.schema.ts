import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type UserCampaignDocument = HydratedDocument<UserCampaign>;

@Schema({
  timestamps: true,
  collection: 'users_campaigns',
})
export class UserCampaign {
  @Prop({
    type: Number,
    required: true,
  })
  userId: number;

  @Prop({
    type: Number,
    required: true,
  })
  campaignId: number;

  @Prop({
    type: Object,
    required: false,
  })
  metadata?: {
    volume?: number;
  };
}

export const UserCampaignSchema = SchemaFactory.createForClass(UserCampaign);

UserCampaignSchema.index({ userId: 1, campaignId: 1 });
