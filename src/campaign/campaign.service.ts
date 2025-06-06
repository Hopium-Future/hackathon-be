import Redis from 'ioredis';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Inject,
  Logger,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

import * as campaigns from '../assets/campaigns.json';
import { ORDER_EVENTS } from '../orders/constants/events';
import {
  OrderClosedPayload,
  OrderCreatedPayload,
} from '../tasks/type/order.type';
import { UserCampaign } from './schemas/user-campaign.schema';
import { Condition, EventData, Status } from './type/campaign.type';
import { REDIS_PROVIDER } from 'src/redis/redis.provider';
import { UsersService } from 'src/users/users.service';
import { CampaignReward } from './dto/campaign.dto';
import * as dayjs from 'dayjs';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);
  constructor(
    private readonly userService: UsersService,
    @InjectModel(UserCampaign.name)
    private readonly userCampaignModel: Model<UserCampaign>,
    @Inject(REDIS_PROVIDER.CACHE) private readonly redisCache: Redis,
  ) {}

  async getCampaigns() {
    const result = Promise.all(
      campaigns.map(async (campaign) => {
        const status = await this.getCampaignStatus(
          campaign.startDate,
          campaign.endDate,
        );

        return {
          id: campaign._id,
          title: campaign.title,
          description: campaign.description,
          logo: campaign.logo,
          background: campaign.background,
          status,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          totalReward: campaign.totalReward,
        };
      }),
    );

    return result;
  }

  async getTotalRewardPaid() {
    let result = [];

    try {
      result = JSON.parse(await this.redisCache.get('campaign:totalReward'));
    } catch (error) {
      this.logger.error(error.message);
    }

    return result;
  }

  async setTotalRewardPaid(data: CampaignReward[]) {
    try {
      await this.redisCache.set('campaign:totalReward', JSON.stringify(data));
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  async findCampaignById(campaignId: number) {
    const campaign = campaigns.find((campaign) => campaign._id === campaignId);

    if (!campaign) {
      throw new BadRequestException('Campaign not found');
    }

    return campaign;
  }

  async getCampaignStatus(startDate: string, endDate: string) {
    const now = dayjs();
    const start = dayjs(startDate).utc();
    const end = dayjs(endDate).utc();

    if (now.isBefore(start)) {
      return Status.UPCOMING;
    }

    if (now.isAfter(end)) {
      return Status.COMPLETED;
    }

    return Status.ONGOING;
  }

  async getCampaignDetail(campaignId: number) {
    const campaign = await this.findCampaignById(campaignId);

    return {
      id: campaign._id,
      title: campaign.title,
      description: campaign.description,
      logo: campaign.logo,
      background: campaign.background,
      status: await this.getCampaignStatus(
        campaign.startDate,
        campaign.endDate,
      ),
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      totalReward: campaign.totalReward,
      ruleContent: campaign.ruleContent,
    };
  }

  async getLeaderboard(campaignId: number, userId: number) {
    const campaign = await this.findCampaignById(campaignId);
    const key = await this.getLeaderboardKey(campaignId);
    let me = await this.getUserCampaignRank(userId, campaign);

    const campaignScores = await this.redisCache.zrevrange(
      key,
      0,
      campaign.limit - 1,
      'WITHSCORES',
    );

    const ranking = [];
    let rank = 1;

    for (let i = 0; i < campaignScores.length; i += 2) {
      const userIdJoinCampaign = parseInt(campaignScores[i]);
      if (userIdJoinCampaign === userId) {
        me = null;
      }
      const score =
        campaign.condition != Condition.TOP_PNL
          ? parseInt(campaignScores[i + 1])
          : parseFloat(parseFloat(campaignScores[i + 1]).toFixed(4));
      const user = await this.userService.getUserById(userIdJoinCampaign);

      ranking.push({
        rank: rank++,
        score,
        userId: userIdJoinCampaign,
        username: user?.username,
        firstName: user?.firstName,
        lastName: user?.lastName,
        photoUrl: user?.photoUrl,
      });
    }

    return {
      ranking,
      me,
    };
  }

  async getUserCampaignRank(userId: number, campaign: any) {
    const user = await this.userService.getUserById(userId);
    const key = await this.getLeaderboardKey(campaign._id);
    const userRank = await this.redisCache.zrevrank(key, userId);
    const userScore = await this.redisCache.zscore(key, userId);

    if (userRank === null || userScore === null) {
      return null;
    }

    return {
      rank: userRank + 1,
      score:
        campaign.condition !== Condition.TOP_PNL
          ? parseInt(userScore)
          : parseFloat(parseFloat(userScore).toFixed(4)),
      userId: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      photoUrl: user.photoUrl,
    };
  }

  async getLeaderboardKey(campaignId: number) {
    return `campaign:leaderboard:${campaignId}`;
  }

  async getOngoingCampaigns() {
    const now = dayjs();
    return campaigns.filter(
      (campaign) =>
        dayjs(campaign.startDate) <= now && dayjs(campaign.endDate) >= now,
    );
  }

  async getUserCampaignData(campaign: any, eventData: EventData) {
    switch (campaign.condition) {
      case Condition.TOP_VOLUME_TRADE:
        const score = eventData.order.order_value;
        const metadata = {
          orderId: eventData.order.displaying_id,
          volume: eventData.order.order_value,
        };

        return {
          score,
          metadata,
        };
      case Condition.TOP_HIGHEST_VOLUME:
        const orderData = eventData.order || eventData.orderClosed;
        return {
          score: eventData.orderClosed
            ? eventData.orderClosed.close_order_value
            : eventData.order.order_value,
          metadata: {
            orderId: orderData.displaying_id,
            volume: orderData.order_value,
            volumeClosed: eventData.orderClosed?.close_order_value ?? 0,
          },
        };
      case Condition.TOP_PNL:
        const orderDataTopPnL = eventData.orderClosed;
        const profit = orderDataTopPnL.profit ?? 0;
        return {
          score: profit,
          metadata: {
            orderId: orderDataTopPnL.displaying_id,
            volume: orderDataTopPnL.order_value,
            volumeClosed: orderDataTopPnL.close_order_value ?? 0,
            profit: profit,
          },
        };
      default:
        return {
          score: 0,
          metadata: {},
        };
    }
  }

  @OnEvent(ORDER_EVENTS.CREATED)
  async handleNewOrderPlaced(order: OrderCreatedPayload) {
    const userId = order.user_id;
    const campaigns = await this.getOngoingCampaigns();

    for (const campaign of campaigns) {
      try {
        const { score, metadata } = await this.getUserCampaignData(campaign, {
          order: order,
        });

        if (score === 0) {
          continue;
        }

        await this.processUserCampaignScore(
          userId,
          campaign._id,
          score,
          metadata,
        );
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  @OnEvent(ORDER_EVENTS.CLOSED)
  async handleNewOrderClosed(order: OrderClosedPayload) {
    const userId = order.user_id;
    const campaigns = await this.getOngoingCampaigns();

    if (!order.close_order_value) {
      return;
    }

    for (const campaign of campaigns) {
      try {
        const { score, metadata } = await this.getUserCampaignData(campaign, {
          orderClosed: order,
        });

        if (score === 0) {
          continue;
        }

        await this.processUserCampaignScore(
          userId,
          campaign._id,
          score,
          metadata,
        );
      } catch (error) {
        this.logger.error(error);
      }
    }
  }

  async processUserCampaignScore(
    userId: number,
    campaignId: number,
    score: number,
    metadata: any,
  ) {
    const key = await this.getLeaderboardKey(campaignId);

    await this.redisCache.zincrby(key, score, userId);

    await this.userCampaignModel.create({
      userId,
      campaignId: campaignId,
      metadata,
    });
  }
}
