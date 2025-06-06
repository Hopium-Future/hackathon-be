import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Inject, Injectable, Logger } from '@nestjs/common';

import Redis from 'ioredis';
import * as dayjs from 'dayjs';
import { REDIS_PROVIDER } from 'src/redis/redis.provider';

import { UsersService } from 'src/users/users.service';
import { OrderService } from 'src/orders/order.service';
import { CampaignService } from 'src/campaign/campaign.service';
import { CommissionService } from 'src/commission/commission.service';

import { Post } from 'src/feed/schemas/post.schema';
import { PostStatus } from 'src/feed/constants/posts';
import { Partner } from 'src/users/schemas/partners.schema';
import { PaginationQueryOffsetDto } from 'src/commons/dtos/pagination-query.dto';
import { Asset } from '../wallets/constants/common';

@Injectable()
export class EarnService {
  private readonly logger = new Logger(EarnService.name);

  constructor(
    @InjectModel(Partner.name) private partnerModel: Model<Partner>,
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    private readonly usersService: UsersService,
    private readonly orderService: OrderService,
    private readonly campaignService: CampaignService,
    private readonly commissionService: CommissionService,
    @Inject(REDIS_PROVIDER.CACHE) private readonly redisCache: Redis,
  ) {}

  async getCalls(userId: number, query: PaginationQueryOffsetDto) {
    const calls = await this.postModel
      .find({ userId, status: PostStatus.CLOSED })
      .sort('-createdAt')
      .select('symbol side createdAt orderId')
      .skip(query.offset)
      .limit(query.limit + 1)
      .lean()
      .exec();

    const orderIds = calls.map((item) => item.orderId);
    const listCommission =
      await this.commissionService.getCallCommissionShareToMaster(orderIds);

    const result = calls.map((item) => ({
      ...item,
      commission:
        listCommission.find((comm) => {
          return comm.order_id === item.orderId;
        })?.total_commission || 0,
    }));

    return {
      data: result.slice(0, query.limit),
      hasMore: result.length > query.limit,
    };
  }

  async getReferrals(userId: number, query: PaginationQueryOffsetDto) {
    return await this.usersService.getFriends(userId, query);
  }

  async getCampaigns() {
    return await this.campaignService.getCampaigns();
  }

  async getCampaignDetail(campaignId: number) {
    return await this.campaignService.getCampaignDetail(campaignId);
  }

  async getCampaignLeaderboard(userId: number, campaignId: number) {
    return await this.campaignService.getLeaderboard(campaignId, userId);
  }

  async getInfo(userId: number) {
    const [userProfile, totalCommission, totalCallCommission, totalWeeklyPoolRevenue, userRankWeeklyPoolRevenue] =
      await Promise.all([
        this.orderService.getUserAchievement(userId),
        this.commissionService.getTotalCommission(userId, Asset.USDT),
        this.commissionService.getTotalCallCommission(userId),
        this.commissionService.getWeeklyPoolRevenue(),
        this.commissionService.getUserRankWeeklyPool(userId),
      ]);

    return {
      totalCommission,
      totalCallCommission,
      totalWeeklyPoolRevenue,
      userRankWeeklyPoolRevenue,
      currentVolume: userProfile?.volume30d,
      tiers: await this.partnerModel.find().sort('_id').lean().exec(),
    }
  }
}
