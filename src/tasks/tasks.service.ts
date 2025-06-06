import {
  Logger,
  Inject,
  Injectable,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Cron } from '@nestjs/schedule';
import { FilterQuery, Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

import Redis from 'ioredis';

import {
  Condition,
  Group,
  OtherTaskCode,
  ReachVolumeType,
  Status,
  Type,
} from './type/task.type';
import { TaskQueryDto } from './dto/task-query.dto';
import { Asset } from '../wallets/constants/common';
import { Task } from './schemas/task.schema';
import { UserTask } from './schemas/user-task.schema';
import { UserTaskLog } from './schemas/user-task-log.schema';
import { Depositwithdraw } from './schemas/depositwithdraw.schema';
import { WalletsService } from 'src/wallets/wallets.service';
import { CommissionService } from 'src/commission/commission.service';
import { OrderType } from 'src/commission/constants/common';
import { REDIS_PROVIDER } from 'src/redis/redis.provider';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { TaskRewardService } from './task-reward.service';
import { OnEvent } from '@nestjs/event-emitter';
import { ORDER_EVENTS } from 'src/orders/constants/events';
import { OrderCreatedPayload } from './type/order.type';
import { UsersService } from '../users/users.service';
import { NOTICE_TEMPLATES } from 'src/chatbot/constants/template';
import { ChatbotService } from 'src/chatbot/chatbot.service';
import { TaskOtherDto } from './dto/task-other.dto';
import { UserTaskOrderLog } from './schemas/user-task-order-log.schema';
import { FutureOrder } from 'src/orders/schemas/future-order.schema';
import { CHATBOT_EVENTS } from '../chatbot/constants/events';
import { KafkaClientService } from 'src/kafka-client/kafka-client.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  constructor(
    @InjectModel(Task.name)
    private readonly taskModel: Model<Task>,
    @InjectModel(UserTask.name)
    private readonly userTaskModel: Model<UserTask>,
    @InjectModel(UserTaskLog.name)
    private readonly userTaskLogModel: Model<UserTaskLog>,
    @InjectModel(UserTaskOrderLog.name)
    private readonly userTaskOrderLogModel: Model<UserTaskOrderLog>,
    @InjectModel(FutureOrder.name)
    private readonly futureOrderModel: Model<FutureOrder>,
    @InjectModel(Depositwithdraw.name) private dwModel: Model<Depositwithdraw>,
    private readonly walletService: WalletsService,
    private readonly commissionService: CommissionService,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    @Inject(REDIS_PROVIDER.CACHE) private readonly redisCache: Redis,
    private readonly taskRewardService: TaskRewardService,
    private readonly chatbotService: ChatbotService,
    private readonly kafkaClient: KafkaClientService,
  ) {}

  async getUserTasks(userId: number, query: TaskQueryDto) {
    const result = [];

    const filter: FilterQuery<Task> = {
      isEnable: true,
    };

    if (query.group) {
      filter.group = query.group;
    }

    const tasks = await this.taskModel.find(filter).sort({ _id: 1 });

    const userTasks = await this.userTaskModel.find({ userId });

    const activeUserStreak = await this.getActiveUserStreak(userId);

    for (const task of tasks) {
      const userTask = userTasks.find(
        (userTask) => userTask.taskId === task._id,
      );
      const status = await this.getUserTaskStatus(
        task.code,
        task.type,
        userTask,
      );
      const active = `DS${activeUserStreak}` === task.code;
      const metadata =
        task.group === Group.TRADE2AIRDROP
          ? {
              progress: userTask ? userTask.metadata?.progress || 0 : 0,
              total: task.metadata?.total || 0,
            }
          : {};

      result.push({
        _id: task._id,
        title: task.title,
        buttonText: task.buttonText,
        icon: task.icon,
        link: task.link,
        rewardQuantity: task.rewardQuantity,
        status,
        active,
        condition: task.condition,
        metadata,
      });
    }

    return result;
  }

  async getActiveUserStreak(userId: number) {
    const streakKey = await this.getDailyStreakKey();
    const currentStreak =
      Number(await this.redisCache.hget(streakKey, String(userId))) ?? 0;

    if (currentStreak > 7) {
      return 1;
    }

    return currentStreak + 1;
  }

  async getUserTaskStatus(code, type, userTask) {
    if (type !== Type.DAILY_STREAK) {
      return userTask ? userTask.status : Status.AVAILABLE;
    }

    // Check user first task
    if (!userTask && code === 'DS1') {
      return Status.AVAILABLE;
    }

    return userTask ? userTask.status : Status.LOCKED;
  }

  /**
   * Update user task status from AVAILABLE to CLAIMABLE
   */
  async updateUserTaskClickable(userId: number, taskId: number) {
    const task = await this.taskModel.findById(taskId);

    // Validate task
    if (!task) {
      return true;
    }

    const isAbleClickTask = [
      Condition.AFFILIATE_CLICK,
      Condition.SUBSCRIBE_TWITTER,
      Condition.JOIN_TELEGRAM_GROUP,
      Condition.SUBSCRIBE_TELEGRAM_CHANNEL,
    ].includes(task.condition);

    if (!task.isEnable || !isAbleClickTask) {
      return true;
    }

    const userTask = await this.userTaskModel.findOne({
      userId,
      taskId,
    });

    if (!userTask) {
      await this.userTaskModel.create({
        userId,
        taskId,
        status: Status.CLAIMABLE,
        type: task.type,
      });

      return true;
    }

    if (userTask.status === Status.AVAILABLE) {
      await this.userTaskModel.updateOne(
        { userId, taskId },
        {
          status: Status.CLAIMABLE,
        },
      );
    }

    return true;
  }

  /**
   * Update user task status CLAIMABLE from trigger order place
   */
  async updateUserTaskClaimable(userId: number, task: Task) {
    const taskId = task._id;

    if (!task || !task.isEnable) {
      return true;
    }

    const userTask = await this.userTaskModel.findOne({
      userId,
      taskId,
    });

    if (!userTask) {
      await this.userTaskModel.create({
        userId,
        taskId,
        status: Status.CLAIMABLE,
        type: task.type,
      });

      return true;
    }

    await this.userTaskModel.updateOne(
      { userId, taskId },
      {
        status: Status.CLAIMABLE,
      },
    );

    return true;
  }

  /**
   * Manual claim task
   */
  async claimTask(userId: number, taskId: number) {
    const lockKey = `task:${taskId}:${userId}:lock`;
    const isLocked = (await this.cacheManager.get(lockKey)) === 1;
    if (isLocked) {
      throw new BadRequestException('Task is claiming');
    }

    await this.cacheManager.set(lockKey, 1, 5 * 60000 /* 5 minutes */);

    try {
      const task = await this.taskModel.findById(taskId);

      // Validate task
      if (!task || !task.isEnable) {
        throw new BadRequestException('Task not found');
      }

      // List task condition manual claim
      const isAbleClaimTask = [
        Condition.DAILY_TRADING,
        Condition.DAILY_CHECK_IN,
        Condition.REACH_DEPOSIT_VOLUME,
        Condition.REACH_TRADE_VOLUME,
        Condition.COMPLETE_CHILD_MISSION,
        Condition.AFFILIATE_CLICK,
        Condition.SUBSCRIBE_TWITTER,
        Condition.JOIN_TELEGRAM_GROUP,
        Condition.SUBSCRIBE_TELEGRAM_CHANNEL,
      ].includes(task.condition);

      if (!isAbleClaimTask) {
        throw new BadRequestException('Task cannot manual claim');
      }
      // End validate task

      // Claim reward task
      const { rewardAsset, rewardQuantity } = await this.processClaimTask(
        userId,
        task,
      );

      return {
        success: true,
        rewardAsset,
        rewardQuantity,
      };
    } catch (error) {
      throw error;
    } finally {
      await this.cacheManager.del(lockKey);
    }
  }

  async claimOtherTask(userId: number, data: TaskOtherDto) {
    try {
      switch (data.code) {
        case OtherTaskCode.SHARE_PNL_X:
          return await this.claimShareXTask(userId, data.orderId ?? 0);
        default:
          throw new BadRequestException('Task not found');
      }
    } catch (error) {
      this.logger.error('Error claimShareXTask: ' + error.message);
    }
  }

  async isOtherTaskClaimed(userId: number, code: string, orderId: number) {
    try {
      switch (code) {
        case OtherTaskCode.SHARE_PNL_X:
          const isClaimed = await this.userTaskOrderLogModel.exists({
            orderId: orderId,
            userId: userId,
            taskCode: OtherTaskCode.SHARE_PNL_X,
          });

          return {
            success: isClaimed ? true : false,
          };
        default:
          throw new BadRequestException('Task not found');
      }
    } catch (error) {
      this.logger.error('Error isOtherTaskClaimed: ' + error.message);
    }
  }

  async claimShareXTask(userId: number, orderId: number) {
    try {
      const isClaimed = await this.userTaskOrderLogModel.exists({
        orderId: orderId,
        userId: userId,
        taskCode: OtherTaskCode.SHARE_PNL_X,
      });

      if (isClaimed) {
        return {
          success: false,
        };
      }

      const isOrderExist = await this.futureOrderModel.exists({
        displaying_id: orderId,
        user_id: userId,
      });

      if (!isOrderExist) {
        return {
          success: false,
        };
      }

      const user = await this.userService.getUserById(userId);
      await this.walletService.changeBalance({
        assetId: Asset.HOPIUM,
        category: 2001,
        lockedValueChange: 0,
        note: `[Task] Claim share X PNL task`,
        options: '',
        userId: String(userId),
        valueChange: 300,
      });

      await this.userTaskOrderLogModel.create({
        orderId: orderId,
        taskCode: OtherTaskCode.SHARE_PNL_X,
        userId: userId,
      });

      this.chatbotService.sendNoticeTemplate({
        telegramId: user.telegramId,
        templateName: NOTICE_TEMPLATES.SHARE_PNL_REWARD,
        params: {
          orderId: orderId,
          amount: 300,
          unit: 'HOPIUM',
        },
      });

      return {
        success: true,
      };
    } catch (error) {
      this.logger.error('Error claimShareXTask: ' + error.message);
    }
  }

  async getDailyStreakKey() {
    return `task:streak:track`;
  }

  async getDailyClaimedKey() {
    const dayNow = dayjs().format('YYYY-MM-DD');
    return `task:streak:claimed:${dayNow}`;
  }

  async getUserIdsClaimableToday(): Promise<number[]> {
    const dailyClaimedKey = await this.getDailyClaimedKey();
    const result = await this.redisCache.smembers(dailyClaimedKey);

    return result.map((userId) => Number(userId));
  }

  async getUserIdsClaimableByDate(date: string): Promise<number[]> {
    const key = `task:streak:claimed:${date}`;
    const result = await this.redisCache.smembers(key);

    return result.map((userId) => Number(userId));
  }

  async isClaimableToday(userId: number) {
    const userIds = await this.getUserIdsClaimableToday();

    return userIds.includes(userId);
  }

  async updateDailyStreakTaskStatus(userId: number) {
    try {
      if (await this.isClaimableToday(userId)) {
        return;
      }

      const streakKey = await this.getDailyStreakKey();
      const currentStreak =
        (await this.redisCache.hget(streakKey, String(userId))) ?? 0;

      let userStreak = Number(currentStreak) + 1;

      // Reset user streak if user claim more than 7 days
      if (userStreak > 7) {
        userStreak = 1;
        await this.userTaskModel.updateMany(
          {
            type: Type.DAILY_STREAK,
            userId: userId,
          },
          { status: Status.LOCKED },
        );
        await this.userTaskModel.updateOne(
          {
            taskId: 1, // First streak task
            type: Type.DAILY_STREAK,
            userId: userId,
          },
          { status: Status.AVAILABLE },
        );
      }

      // Find & update current user streak
      const streakTask = await this.taskModel.findOne({
        type: Type.DAILY_STREAK,
        code: `DS${userStreak}`,
      });

      await this.updateUserTaskClaimable(userId, streakTask);

      const dailyClaimedKey = await this.getDailyClaimedKey();
      await this.redisCache.sadd(dailyClaimedKey, userId); // Update user claimed today
      await this.redisCache.pexpire(dailyClaimedKey, 3 * 24 * 60 * 60000); // Set pexpire 3 days
      await this.redisCache.hset(streakKey, String(userId), userStreak); // Update user streak
    } catch (e) {
      this.logger.error('Error claimDailyStreakTask: ' + e.message);
    }
  }

  /**
   * Process claim task if status is CLAIMABLE
   */
  async processClaimTask(userId: number, task: Task) {
    const taskId = task._id;

    const userTask = await this.userTaskModel
      .findOne({
        userId,
        taskId,
      })
      .lean();

    if (userTask && userTask.status !== Status.CLAIMABLE) {
      throw new BadRequestException('Task cannot claimed yet!');
    }

    await this.userTaskModel.updateOne(
      { userId, taskId },
      {
        type: task.type,
        status: Status.COMPLETED,
        claimedAt: new Date(),
        completedAt: new Date(),
      },
      {
        upsert: true,
      },
    );

    let rewardAsset = Asset.HOPIUM;
    let rewardQuantity = task.rewardQuantity;
    if (task.condition === Condition.COMPLETE_CHILD_MISSION) {
      const randomReward = await this.taskRewardService.spin();
      rewardAsset = randomReward.rewardAsset;
      rewardQuantity = randomReward.rewardQuantity;
    }

    await this.userTaskLogModel.create({
      userId,
      taskId,
      action: 'CLAIM',
      metadata: {
        rewardAsset: rewardAsset,
        rewardQuantity: rewardQuantity,
      },
    });

    await this.walletService.changeBalance({
      assetId: rewardAsset,
      category: 2001, // Task category
      lockedValueChange: 0,
      note: `[Task] Claim task #${taskId}`,
      options: '',
      userId: String(userId),
      valueChange: rewardQuantity,
    });

    try {
      const user = await this.userService.getUserById(userId);

      this.commissionService.pushCommission({
        amount: rewardQuantity,
        fromUserId: user._id,
        toUserId: user._id,
        referralCode: user.referralCode,
        type: OrderType.MISSION,
        assetId: rewardAsset,
      });
    } catch (e) {
      this.logger.error('Error pushCommission: ' + e.message);
    }

    return {
      rewardAsset,
      rewardQuantity,
    };
  }

  @OnEvent(ORDER_EVENTS.CREATED)
  async handleNewOrderPlaced(order: OrderCreatedPayload) {
    const userId = order.user_id;
    const volume = order.order_value;

    try {
      this.updateDailyStreakTaskStatus(userId);

      // Update trade2airdrop task
      await this.updateClaimableReachVolumeTask(
        userId,
        volume,
        ReachVolumeType.TRADE,
      );
      await this.updateClaimableParentMission(userId);
      // End update trade2airdrop task
    } catch (error) {
      console.error('Error triggerOrderPlace', error);
    }
  }

  @Cron('1 0 * * *', { timeZone: 'UTC' })
  async resetDailyReward() {
    this.logger.log('resetDailyReward start');

    try {
      const oneDayAgo = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      const twoDayAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');

      const oneDayAgoUserIds = await this.getUserIdsClaimableByDate(oneDayAgo);
      const twoDayAgoUserIds = await this.getUserIdsClaimableByDate(twoDayAgo);

      // Active user task at the new day if user open order yesterday
      for (const oneDayAgoUserId of oneDayAgoUserIds) {
        // Active user task at the new day
        try {
          const taskId = await this.getActiveUserStreak(oneDayAgoUserId);
          await this.userTaskModel.updateOne(
            { userId: oneDayAgoUserId, taskId },
            {
              type: Type.DAILY_STREAK,
              status: Status.AVAILABLE,
            },
            {
              upsert: true,
            },
          );
        } catch (e) {
          this.logger.error('Error update user task status: ' + e.message);
        }
      }

      // Get user claimable 2 days ago but not claimable yesterday
      const userIds = twoDayAgoUserIds.filter(
        (userId) => !oneDayAgoUserIds.includes(userId),
      );

      if (!userIds.length) {
        this.logger.log('resetDailyReward empty');
        return;
      }

      for (const userId of userIds) {
        try {
          const streakKey = await this.getDailyStreakKey();
          await this.redisCache.hset(streakKey, String(userId), 0);
        } catch (e) {
          this.logger.error('Error resetDailyReward: ' + e.message);
        }
      }

      await this.userTaskModel.updateMany(
        {
          type: Type.DAILY_STREAK,
          userId: { $in: userIds },
        },
        { status: Status.LOCKED },
      );

      await this.userTaskModel.updateMany(
        {
          taskId: 1, // First streak task
          userId: { $in: userIds },
        },
        { status: Status.AVAILABLE },
      );
    } catch (e) {
      this.logger.error('Error resetDailyReward: ' + e.message);
    }

    this.logger.log('resetDailyReward done');
  }

  @Cron('* * * * *', { timeZone: 'UTC' })
  async claimDepositReward() {
    try {
      const startOfOneMinuteAgo = dayjs()
        .utc()
        .subtract(1, 'minute')
        .startOf('minute');
      const endOfOneMinuteAgo = dayjs()
        .utc()
        .subtract(1, 'minute')
        .endOf('minute');
      const listDW = await this.dwModel
        .find({
          type: 1,
          status: 2,
          createdAt: { $gte: startOfOneMinuteAgo, $lt: endOfOneMinuteAgo },
        })
        .select('_id userId usdValue amount assetId');

      if (listDW && listDW.length > 0) {
        for (const item of listDW) {
          try {
            const user = await this.userService.getUserById(item.userId);
            const assetConfig = await this.walletService.getAssetById(
              item?.assetId,
            );
            this.kafkaClient.emit(CHATBOT_EVENTS.USER_DEPOSIT, {
              userId: item.userId,
              username: user?.username,
              firstName: user?.firstName,
              lastName: user?.lastName,
              amount: item?.amount,
              assetCode: assetConfig?.assetCode,
            });
          } catch (e) {
            this.logger.error(
              `Error push message kafka deposit ${item}` + e.message,
            );
          }

          try {
            await this.updateClaimableReachVolumeTask(
              item.userId,
              item.usdValue,
              ReachVolumeType.DEPOSIT,
            );

            await this.updateClaimableParentMission(item.userId);
          } catch (e) {
            this.logger.error(
              `Error reward mission deposit ${item}` + e.message,
            );
          }
        }
      }
    } catch (e) {
      this.logger.error('Error claimDepositReward: ' + e.message);
    }
  }

  async updateClaimableReachVolumeTask(
    userId: number,
    volume: number,
    type: string,
  ) {
    try {
      let condition: Condition;
      if (type === ReachVolumeType.TRADE) {
        condition = Condition.REACH_TRADE_VOLUME;
      } else if (type === ReachVolumeType.DEPOSIT) {
        condition = Condition.REACH_DEPOSIT_VOLUME;
      } else {
        return;
      }

      const task = await this.taskModel.findOne({
        type: Type.ONE_TIME,
        condition: condition,
        isEnable: true,
      });

      if (!task) {
        return;
      }

      const userTask = await this.userTaskModel.findOne({
        userId,
        taskId: task._id,
      });

      if (!userTask) {
        return await this.userTaskModel.create({
          userId,
          taskId: task._id,
          status:
            volume >= task.metadata?.total
              ? Status.CLAIMABLE
              : Status.AVAILABLE,
          type: task.type,
          metadata: {
            progress: volume,
            total: task.metadata?.total,
          },
        });
      }

      if (
        userTask.status === Status.COMPLETED ||
        userTask.status === Status.CLAIMABLE
      ) {
        return userTask;
      }

      const currentVolume = userTask.metadata?.progress || 0;
      const isCompleted = volume + currentVolume >= task.metadata?.total;

      return await this.userTaskModel.updateOne(
        { userId, taskId: task._id },
        {
          type: task.type,
          status: isCompleted ? Status.CLAIMABLE : Status.AVAILABLE,
          metadata: {
            progress: currentVolume + volume,
            total: task.metadata?.total,
          },
        },
      );
    } catch (e) {
      this.logger.error('Error updateClaimableReachVolumeTask: ' + e.message);
    }

    return null;
  }

  async updateClaimableParentMission(userId: number) {
    try {
      const task = await this.taskModel.findOne({
        condition: Condition.COMPLETE_CHILD_MISSION,
        isEnable: true,
      });

      if (!task) {
        return;
      }

      const userTask = await this.userTaskModel.findOne({
        userId,
        taskId: task._id,
      });

      if (
        userTask &&
        [Status.CLAIMABLE, Status.COMPLETED].includes(userTask.status)
      ) {
        return;
      }

      // Check all child mission completed
      const tasks = await this.taskModel.find({
        condition: {
          $in: [Condition.REACH_DEPOSIT_VOLUME, Condition.REACH_TRADE_VOLUME],
        },
        isEnable: true,
      });

      const countCompletedChildTasks = await this.userTaskModel
        .find({
          userId,
          taskId: { $in: tasks.map((task) => task._id) },
          status: { $in: [Status.CLAIMABLE, Status.COMPLETED] },
        })
        .countDocuments();
      const isCompleted = countCompletedChildTasks === tasks.length;

      await this.userTaskModel.updateOne(
        { userId, taskId: task._id },
        {
          type: task.type,
          status: isCompleted ? Status.CLAIMABLE : Status.AVAILABLE,
          metadata: {
            progress: countCompletedChildTasks,
            total: tasks.length,
          },
        },
        {
          upsert: true,
        },
      );
    } catch (e) {
      this.logger.error('Error updateClaimableParentMission: ' + e.message);
    }
  }

  async hardResetDailyReward() {
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const oneDayAgo = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
      const twoDayAgo = dayjs().subtract(2, 'day').format('YYYY-MM-DD');

      const todayUserIds = await this.getUserIdsClaimableByDate(today);
      const oneDayAgoUserIds = await this.getUserIdsClaimableByDate(oneDayAgo);
      const twoDayAgoUserIds = await this.getUserIdsClaimableByDate(twoDayAgo);

      // Get unique user open order in 3 days
      const userIds = [
        ...todayUserIds,
        ...oneDayAgoUserIds,
        ...twoDayAgoUserIds,
      ].filter((userId, index, self) => self.indexOf(userId) === index);
      const resetUserIds = [];
      const streakKey = await this.getDailyStreakKey();
      const streakUserIds = await this.redisCache.hkeys(streakKey);

      for (const streakUserId of streakUserIds) {
        if (userIds.includes(Number(streakUserId))) {
          continue;
        }
        resetUserIds.push(Number(streakUserId));
        await this.redisCache.hdel(streakKey, streakUserId);
      }

      this.logger.log('resetUserIds: ' + resetUserIds);

      if (!resetUserIds.length) {
        this.logger.log('resetUserIds empty');
        return;
      }

      await this.userTaskModel.updateMany(
        {
          type: Type.DAILY_STREAK,
          userId: { $in: resetUserIds },
        },
        { status: Status.LOCKED },
      );

      await this.userTaskModel.updateMany(
        {
          taskId: 1, // First streak task
          userId: { $in: resetUserIds },
        },
        { status: Status.AVAILABLE },
      );

      return resetUserIds.length;
    } catch (e) {
      throw new BadRequestException('Error hardResetDailyReward: ' + e.message);
    }
  }
}
