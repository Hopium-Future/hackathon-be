import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber } from 'class-validator';

export class LeaderboardSummaryDto {
  @ApiProperty()
  @IsNumber()
  profit: number;

  @ApiProperty()
  @IsNumber()
  volume: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsInt()
  callerUserId?: number;
}
