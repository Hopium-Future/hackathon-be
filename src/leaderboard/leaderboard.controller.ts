import {
  Get,
  Query,
  Logger,
  UseGuards,
  Controller,
  UseInterceptors,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagePattern, Payload, Transport } from '@nestjs/microservices';

import { AuthGuard } from 'src/auth/auth.guard';
import { CacheTTL } from '@nestjs/cache-manager';
import { TIME_MS } from 'src/commons/constants/time';
import { UserHeader } from 'src/auth/type/auth.type';
import { UserAuth } from 'src/commons/decorators/user.decorator';
import { UserCacheInterceptor } from 'src/commons/interceptors/user-cache.interceptor';

import { LeaderboardTab } from './constants/leaderboard';
import { LeaderboardService } from './leaderboard.service';
import { CHATBOT_EVENTS } from '../chatbot/constants/events';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Controller('leaderboard')
@ApiBearerAuth()
@ApiTags('leaderboard')
export class LeaderboardController {
  private readonly logger = new Logger(LeaderboardController.name);
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  //@CacheTTL(1 * TIME_MS.HOUR)
  //@UseInterceptors(UserCacheInterceptor)
  @UseGuards(AuthGuard, ThrottlerGuard)
  async getLeaderboard(
    @UserAuth() userData: UserHeader,
    @Query() query: LeaderboardQueryDto,
  ) {
    return this.leaderboardService.getLeaderboard(userData.id, query);
  }

  @Get('/sync-achievements')
  async syncAchievements() {
    await this.leaderboardService.devAwardAchievements();
    return 'OK';
  }

  @MessagePattern(CHATBOT_EVENTS.LEADERBOARD_GET_BY_USERIDS, Transport.KAFKA)
  async getLeadeboardByUserIds(
    @Payload() payload: { user_ids: number[]; type: LeaderboardTab },
  ) {
    if (!payload || !payload.user_ids || !payload.type) {
      this.logger.error('Invalid payload', payload);
      return;
    }

    return this.leaderboardService.getLeaderboardByUserIds(
      payload.user_ids,
      payload.type,
    );
  }
}
