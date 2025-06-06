import { CacheTTL } from '@nestjs/cache-manager';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AuthGuard } from 'src/auth/auth.guard';
import { UserHeader } from 'src/auth/type/auth.type';
import { TIME_MS } from 'src/commons/constants/time';
import { UserAuth } from 'src/commons/decorators/user.decorator';
import { UserCacheInterceptor } from 'src/commons/interceptors/user-cache.interceptor';

import { EarnService } from './earn.service';
import { PaginationQueryOffsetDto } from 'src/commons/dtos/pagination-query.dto';

@Controller('earn')
@ApiBearerAuth()
@ApiTags('earn')
@UseGuards(AuthGuard, ThrottlerGuard)
export class EarnController {
  constructor(private readonly earnService: EarnService) {}

  // Calls
  @Get('/calls')
  async getListCalls(
    @UserAuth() userData: UserHeader,
    @Query() query: PaginationQueryOffsetDto,
  ) {
    return this.earnService.getCalls(userData.id, query);
  }

  // Referrals
  @Get('/referrals')
  async getListReferrals(
    @UserAuth() userData: UserHeader,
    @Query() query: PaginationQueryOffsetDto,
  ) {
    return this.earnService.getReferrals(userData.id, query);
  }

  // Campaigns
  @Get('/campaigns')
  async getListCampaigns() {
    return this.earnService.getCampaigns();
  }

  @Get('/campaigns/:campaignId')
  async getCampaignDetail(
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    return this.earnService.getCampaignDetail(campaignId);
  }

  @Get('campaigns/:campaignId/leaderboard')
  async getLeaderboard(
    @UserAuth() userData: UserHeader,
    @Param('campaignId', ParseIntPipe) campaignId: number,
  ) {
    return this.earnService.getCampaignLeaderboard(userData.id, campaignId);
  }

  // Info
  @Get('/info')
  @CacheTTL(1 * TIME_MS.HOUR)
  @UseInterceptors(UserCacheInterceptor)
  async getEarnInfo(@UserAuth() userData: UserHeader) {
    return this.earnService.getInfo(userData.id);
  }
}
