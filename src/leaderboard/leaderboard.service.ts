import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { Injectable, Logger } from '@nestjs/common';

import * as dayjs from 'dayjs';

import { ORDER_EVENTS } from 'src/orders/constants/events';
import { OrderClosedPayload } from 'src/orders/type/order.type';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';
import { LeaderboardSummaryDto } from './dto/leaderboard-summary.dto';
import { LeaderboardHistory } from './schemas/leaderboard-history.schema';
import { LeaderboardSummary } from './schemas/leaderboard-summary.schema';
import { LeaderboardTab, LeaderboardType } from './constants/leaderboard';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeaderboardAchievement } from './schemas/leaderboard-achievement.schema';
import { Command } from 'nestjs-command';

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    @InjectModel(LeaderboardHistory.name)
    private leaderboardHistoryModel: Model<LeaderboardHistory>,
    @InjectModel(LeaderboardSummary.name)
    private leaderboardSummaryModel: Model<LeaderboardSummary>,
    @InjectModel(LeaderboardAchievement.name)
    private leaderboardAchievementModel: Model<LeaderboardAchievement>,
  ) {}

  async getLeaderboard(userId: number, query: LeaderboardQueryDto) {
    const currentMonth = dayjs().format('MM-YYYY');

    let type;
    switch (query.tab) {
      case LeaderboardTab.PROFIT:
      case LeaderboardTab.LOSS:
        type = LeaderboardType.PNL;
        break;

      case LeaderboardTab.VOLUME:
        type = LeaderboardType.VOLUME;
        break;

      case LeaderboardTab.COPY_COUNTER:
        type = LeaderboardType.COPY_COUNTER;
        break;

      default:
        break;
    }

    if (!type) {
      return {
        me: null,
        data: [],
      };
    }

    const me = await this.leaderboardSummaryModel
      .findOne({
        userId,
        type,
        time: currentMonth,
      })
      .populate({
        path: 'user',
        select: 'username firstName lastName photoUrl',
      })
      .lean()
      .exec();

    const data = await this.leaderboardSummaryModel
      .find({ type, time: currentMonth })
      .sort({ value: query.tab === LeaderboardTab.LOSS ? 1 : -1 })
      .populate({
        path: 'user',
        select: 'username firstName lastName photoUrl',
      })
      .limit(10)
      .lean()
      .exec();

    return {
      me,
      data,
    };
  }

  // Get leaderboard by user ids
  async getLeaderboardByUserIds(userIds: number[], tab: LeaderboardTab) {
    const currentMonth = dayjs().format('MM-YYYY');

    let type;
    switch (tab) {
      case LeaderboardTab.PROFIT:
      case LeaderboardTab.LOSS:
        type = LeaderboardType.PNL;
        break;

      case LeaderboardTab.VOLUME:
        type = LeaderboardType.VOLUME;
        break;

      case LeaderboardTab.COPY_COUNTER:
        type = LeaderboardType.COPY_COUNTER;
        break;

      default:
        break;
    }

    if (!type) {
      return [];
    }

    return await this.leaderboardSummaryModel
      .find({ userId: { $in: userIds }, type, time: currentMonth })
      .sort({ value: tab === LeaderboardTab.LOSS ? 1 : -1 })
      .populate({
        path: 'user',
        select: 'username firstName lastName photoUrl',
      })
      .limit(10)
      .lean()
      .exec();
  }

  @OnEvent(ORDER_EVENTS.CLOSED)
  async handleOrderClosed(order: OrderClosedPayload) {
    // If order limit or stop canceled, don't update leaderboard
    if (['Limit', 'Stop'].includes(order.type) && order.open_price === 0) {
      return;
    }

    try {
      await this.leaderboardHistoryModel.updateOne(
        {
          userId: order.user_id,
          orderId: order.displaying_id,
        },
        {
          userId: order.user_id,
          orderId: order.displaying_id,
          copyCounterOrderId: order.metadata?.follow_order_id,
          margin: order.margin,
          leverage: order.leverage,
          profit: order.profit,
          rawProfit: order.raw_profit,
          volume: order.order_value,
          closeVolume: order.close_order_value,
          openedAt: order.opened_at,
          closedAt: order.closed_at,
        },
        {
          upsert: true,
        },
      );

      await this.increaseLeaderboardSummaries(order.user_id, {
        profit: order.profit,
        volume: order.order_value,
        callerUserId: order.metadata?.caller_user_id ?? 0,
      });
    } catch (error) {
      this.logger.error(
        `Error update data to leaderboard: ${error.message}`,
        error,
      );
    }
  }

  async increaseLeaderboardSummaries(
    userId: number,
    data: LeaderboardSummaryDto,
  ) {
    try {
      const currentMonth = dayjs().format('MM-YYYY');

      await this.leaderboardSummaryModel.updateOne(
        { userId, type: LeaderboardType.PNL, time: currentMonth },
        { $inc: { value: data.profit } },
        { upsert: true },
      );

      await this.leaderboardSummaryModel.updateOne(
        { userId, type: LeaderboardType.VOLUME, time: currentMonth },
        { $inc: { value: data.volume } },
        { upsert: true },
      );

      if (data.callerUserId > 0) {
        await this.leaderboardSummaryModel.updateOne(
          {
            userId: data.callerUserId,
            type: LeaderboardType.COPY_COUNTER,
            time: currentMonth,
          },
          { $inc: { value: 1 } },
          { upsert: true },
        );
      }
    } catch (error) {
      this.logger.error('Error increaseLeaderboardSummaries: ', error);
    }
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT, { timeZone: 'UTC' })
  @Command({
    command: 'sync:achievements',
    describe: 'Award achievements for leaderboard',
  })
  async awardAchievements() {
    const lastMonth = dayjs().subtract(1, 'month').format('MM-YYYY');

    for (const tab of Object.values(LeaderboardTab)) {
      let type = LeaderboardType.PNL;
      if (tab === LeaderboardTab.COPY_COUNTER) {
        type = LeaderboardType.COPY_COUNTER;
      }
      if (tab === LeaderboardTab.VOLUME) {
        type = LeaderboardType.VOLUME;
      }

      const leaderboardSummaries = await this.leaderboardSummaryModel
        .find({ type, time: lastMonth })
        .sort({ value: tab === LeaderboardTab.LOSS ? 1 : -1 })
        .limit(10)
        .lean()
        .exec();

      leaderboardSummaries.forEach(async (leaderboardSummary, index) => {
        const rank = index + 1;
        await this.leaderboardAchievementModel.updateOne(
          {
            userId: leaderboardSummary.userId,
            type: tab,
            rank,
          },
          { $inc: { counter: 1 } },
          { upsert: true },
        );
      });
    }
  }

  @Command({
    command: 'sync:achievement',
    describe: 'Sync user achievement last month',
  })
  async devAwardAchievements() {
    const lastMonth = dayjs().subtract(1, 'month').format('MM-YYYY');

    for (const tab of Object.values(LeaderboardTab)) {
      let type = LeaderboardType.PNL;
      if (tab === LeaderboardTab.COPY_COUNTER) {
        type = LeaderboardType.COPY_COUNTER;
      }
      if (tab === LeaderboardTab.VOLUME) {
        type = LeaderboardType.VOLUME;
      }

      const leaderboardSummaries = await this.leaderboardSummaryModel
        .find({ type, time: lastMonth })
        .sort({ value: tab === LeaderboardTab.LOSS ? 1 : -1 })
        .limit(10)
        .lean()
        .exec();

      leaderboardSummaries.forEach(async (leaderboardSummary, index) => {
        const rank = index + 1;
        await this.leaderboardAchievementModel.updateOne(
          {
            userId: leaderboardSummary.userId,
            type: tab,
            rank,
          },
          { $inc: { counter: 1 } },
          { upsert: true },
        );
      });
    }
  }
}
