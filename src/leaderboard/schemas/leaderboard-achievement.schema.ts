import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LeaderboardTab } from '../constants/leaderboard';

export type LeaderboardAchievementDocument =
  HydratedDocument<LeaderboardAchievement>;

@Schema({
  timestamps: true,
  collection: 'leaderboard_archievements',
})
export class LeaderboardAchievement {
  @Prop({
    type: Number,
    required: true,
    isInteger: true,
    index: true,
  })
  userId: number;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(LeaderboardTab),
  })
  type: string;

  @Prop({
    type: Number,
    required: true,
  })
  rank: number;

  @Prop({
    type: Number,
    required: true,
  })
  counter: number;
}

export const LeaderboardAchievementSchema = SchemaFactory.createForClass(
  LeaderboardAchievement,
);
