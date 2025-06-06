import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersModule } from 'src/users/users.module';

import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';

import {
  LeaderboardHistory,
  LeaderboardHistorySchema,
} from './schemas/leaderboard-history.schema';
import {
  LeaderboardSummary,
  LeaderboardSummarySchema,
} from './schemas/leaderboard-summary.schema';
import {
  LeaderboardAchievement,
  LeaderboardAchievementSchema,
} from './schemas/leaderboard-achievement.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { CommandModule } from 'nestjs-command';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: LeaderboardHistory.name, schema: LeaderboardHistorySchema },
      { name: LeaderboardSummary.name, schema: LeaderboardSummarySchema },
      {
        name: LeaderboardAchievement.name,
        schema: LeaderboardAchievementSchema,
      },
    ]),
    CommandModule,
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService],
})
export class LeaderboardModule {}
