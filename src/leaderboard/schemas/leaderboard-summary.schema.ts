import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory, Virtual } from '@nestjs/mongoose';
import { User } from 'src/users/schemas/user.schema';
import { LeaderboardType } from '../constants/leaderboard';

export type LeaderboardSummaryDocument = HydratedDocument<LeaderboardSummary>;

@Schema({
  timestamps: true,
  collection: 'leaderboard_summary',
})
export class LeaderboardSummary {
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
    enum: Object.values(LeaderboardType),
  })
  type: string;

  @Prop({
    type: String,
    required: true,
  })
  time: string;

  @Prop({
    type: Number,
    required: true,
  })
  value: number;

  @Virtual({
    options: {
      ref: User.name,
      localField: 'userId',
      foreignField: '_id',
      justOne: true,
    },
  })
  user?: User;
}

export const LeaderboardSummarySchema =
  SchemaFactory.createForClass(LeaderboardSummary);

LeaderboardSummarySchema.index(
  { userId: 1, type: 1, time: 1 },
  { unique: true },
);
