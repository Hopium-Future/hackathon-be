import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeaderboardTab } from '../constants/leaderboard';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    enum: LeaderboardTab,
  })
  @IsOptional()
  @IsEnum(LeaderboardTab)
  tab?: LeaderboardTab;
}
