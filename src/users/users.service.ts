import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { UserProfile, UserProfileDocument } from './schemas/user-profile.schema';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FriendQueryDto } from './dto/friend-query.dto';
import { CommissionService } from 'src/commission/commission.service';
import { Asset } from '../wallets/constants/common';
import { OrderType } from 'src/commission/constants/common';
import { WalletsService } from '../wallets/wallets.service';
import { uniq } from 'src/commons/utils/helper';
import { TIME_MS } from 'src/commons/constants/time';
import { ChatbotService } from 'src/chatbot/chatbot.service';
import { NOTICE_TEMPLATES } from 'src/chatbot/constants/template';
import {
  PartnerType,
  RESET_USER_TIER_QUEUE_NAME,
} from './constants/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { ORDER_EVENTS } from 'src/orders/constants/events';
import {
  OrderClosedPayload,
} from 'src/orders/type/order.type';
import { Partner, Reward } from './schemas/partners.schema';
import { REDIS_PROVIDER } from 'src/redis/redis.provider';
import Redis from 'ioredis';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { UserPartnerLog } from './schemas/user-partner-log.schema';
import { Command, Option } from 'nestjs-command';
import { OrderService } from '../orders/order.service';
import { NotificationService } from 'src/notification/notification.service';
import { PostStar } from 'src/feed/schemas/post-star.schema';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(UserPartnerLog.name)
    private userPartnerLogModel: Model<UserPartnerLog>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfile>,
    @InjectModel(Partner.name) private partnerModel: Model<Partner>,
    @InjectModel(PostStar.name) private readonly postStarModel: Model<PostStar>,
    private readonly walletService: WalletsService,
    private readonly chatbotService: ChatbotService,
    @Inject(forwardRef(() => CommissionService))
    private readonly commissionService: CommissionService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    @Inject(REDIS_PROVIDER.CACHE) private readonly redisCache: Redis,
    @InjectQueue(RESET_USER_TIER_QUEUE_NAME)
    private readonly resetTierQueue: Queue,
    private readonly notificationService: NotificationService,
  ) {}

  async getUserById(userId: number, disableCache = false) {
    const cacheKey = `user:${userId}`;
    if (!disableCache) {
      try {
        const cachedUser = await this.cacheManager.get<User>(cacheKey);
        if (cachedUser) {
          return cachedUser;
        }
      } catch (error) {
        this.logger.error('Error get cached find User: ' + error.message);
      }
    }

    const user = await this.userModel.findById(userId);

    if (user) {
      try {
        await this.cacheManager.set(cacheKey, user, 1 * TIME_MS.DAY);
      } catch (error) {
        this.logger.error('Error set cached find User: ' + error.message);
      }
    }

    return user;
  }

  async getUserByTelegramIdCached(telegramId: number, disableCache = false) {
    const cacheKey = `user:telegram:${telegramId}`;
    if (!disableCache) {
      try {
        const cachedUser = await this.cacheManager.get<User>(cacheKey);
        if (cachedUser) {
          return cachedUser;
        }
      } catch (error) {
        this.logger.error('Error get cached telegram User: ' + error.message);
      }
    }

    const user = await this.getUserByTelegramId(telegramId);

    if (user) {
      try {
        await this.cacheManager.set(cacheKey, user, 1 * TIME_MS.DAY);
      } catch (error) {
        this.logger.error('Error set cached telegram User: ' + error.message);
      }
    }

    return user;
  }

  async getUserByTelegramId(telegramId: number) {
    return this.userModel.findOne({
      telegramId,
    });
  }

  async mapUserTelegramIds(userIds: number[]) {
    const results: Record<number, number> = {};
    userIds = uniq(userIds);

    await Promise.all(
      userIds.map(async (userId) => {
        const cacheKey = this.getMapIdCacheKey(userId);
        const cachedId = await this.cacheManager.get<number>(cacheKey);
        if (cachedId) {
          results[userId] = cachedId;
        }
      }),
    );
    const notCachedIds = userIds.filter((userId) => !results[userId]);

    if (!notCachedIds.length) {
      return results;
    }

    const users = await this.userModel
      .find({
        _id: { $in: notCachedIds },
      })
      .select('_id telegramId');
    if (users.length) {
      users.forEach((user) => {
        results[user._id] = user.telegramId;
        this.cacheManager.set(
          this.getMapIdCacheKey(user._id),
          user.telegramId,
          1 * TIME_MS.DAY,
        );
      });
    }

    return results;
  }

  private getMapIdCacheKey(userId: number) {
    return `user:map_id:${userId}`;
  }

  private async getLastestId() {
    const user = await this.userModel.findOne().sort({ _id: -1 });
    return user?._id || 0;
  }

  private async getIncrementedId() {
    const cacheKey = 'last_user_id';
    let lastId = await this.cacheManager.get<number>(cacheKey);

    if (!lastId) {
      lastId = await this.getLastestId();
    }
    const newId = lastId + 1;

    await this.cacheManager.set(cacheKey, newId, 24 * 60 * 1000);
    return newId;
  }

  private makeReferralCode(id: number) {
    return `HOP${id}`;
  }

  async updateOrCreateUser(data: CreateUserDto) {
    const user = await this.getUserByTelegramId(data.telegramId);

    if (!!user) {
      // User already exists, update it
      user.username = data.username;
      user.firstName = data.firstName;
      user.lastName = data.lastName;
      user.allowsWriteToPm = data.allowsWriteToPm;
      user.languageCode = data.languageCode;
      user.isPremium = data.isPremium;
      user.addedToAttachmentMenu = data.addedToAttachmentMenu;
      user.photoUrl = data.photoUrl;
      user.lastLoggedIn = new Date();

      setTimeout(async () => {
        await user.save();
      }, 0);

      return {
        user,
        isNew: false,
      };
    }

    // Create new user
    const id = await this.getIncrementedId();
    const referralCode = this.makeReferralCode(id);

    const newUser = await this.userModel.create({
      _id: id,
      telegramId: data.telegramId,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      allowsWriteToPm: data.allowsWriteToPm,
      languageCode: data.languageCode,
      isPremium: data.isPremium,
      addedToAttachmentMenu: data.addedToAttachmentMenu,
      photoUrl: data.photoUrl,
      referralCode: referralCode,
      partnerType: PartnerType.NEWBIE,
    });

    try {
      // Upgrade new user to newbie tier
      const partner = await this.partnerModel.findOne({
        _id: PartnerType.NEWBIE,
      });

      if (partner) {
        await this.awardTierReward(id, partner._id, partner.metadata.rewards);

        this.chatbotService.sendNoticeTemplate({
          telegramId: data.telegramId,
          templateName: NOTICE_TEMPLATES.UPGRADE_ACCOUNT_TIER,
          params: {
            accountTier: partner.name,
          },
        });
      }
    } catch (e) {
      this.logger.error('Error reward Hopium onboarding: ' + e.message);
    }

    return {
      user: newUser,
      isNew: true,
    };
  }

  async connectTonWallet(userId: number, tonAddress: string) {
    const existingUser = await this.userModel.findOne({ tonAddress });

    if (existingUser && existingUser._id !== userId) {
      throw new BadRequestException('Ton Wallet already connected');
    }

    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.tonAddress && user.tonAddress !== tonAddress) {
      throw new BadRequestException('Ton Wallet already connected');
    } else if (!user.tonAddress) {
      user.tonAddress = tonAddress;

      await user.save();
    }

    return user;
  }

  async addReferral(id: number, referralCode: string) {
    const user = await this.userModel.findById(id);

    if (!user || user.parentId) {
      throw new BadRequestException(
        `User with ID ${id} does not exist or exist partner`,
      );
    }

    const parent = await this.userModel.findOne({ referralCode });

    if (!parent) {
      throw new BadRequestException('Invalid referral code');
    }

    if (id === parent.id || parent.parentId === id) {
      throw new BadRequestException('User cannot refer yourself');
    }

    const commissionAmount = 5,
      commissionAsset = Asset.HOPIUM;
    try {
      await this.walletService.changeBalance({
        assetId: commissionAsset,
        category: 2000, // Add referral category
        lockedValueChange: 0,
        note: `[Task] Referral`,
        options: '',
        userId: String(parent.id),
        valueChange: commissionAmount, // Default
      });

      await this.commissionService.pushCommission({
        amount: commissionAmount,
        fromUserId: id,
        toUserId: parent.id,
        referralCode,
        type: OrderType.REFERRAL,
        assetId: commissionAsset,
      });
    } catch (e) {
      this.logger.error('Error transfer commission: ' + e.message);
    }

    this.chatbotService.sendNoticeTemplate({
      telegramId: parent.telegramId,
      templateName: NOTICE_TEMPLATES.REFERRAL_COMMISSION,
      params: {
        username: user.username,
        amount: commissionAmount,
        unit: 'HOPIUM',
      },
    });

    user.parentId = parent.id;
    user.referralDate = new Date();

    await user.save();

    return {
      user,
      reward: {
        amount: 0,
        assetId: '',
        assetName: '',
      },
    };
  }

  async getFriends(userId: number, query: FriendQueryDto) {
    const friends = await this.userModel
      .find({
        parentId: userId,
      })
      .limit(query.limit + 1)
      .skip(query.offset)
      .sort({ _id: -1 });

    const listFriend = friends.map((friend) => friend._id);
    const listCommission = await this.commissionService.getListCommission({
      userId,
      listFriend,
      assetId: Asset.USDT,
    });

    const data = friends.map((friend) => {
      const commissionData = listCommission.find(
        (commission) => commission.key === String(friend._id),
      );
      return {
        username: friend.username,
        firstName: friend.firstName,
        lastName: friend.lastName,
        commission: commissionData?.total_commission?.value.toFixed(4) || 0,
      };
    });

    // const total = await this.userModel.countDocuments({
    //   parentId: userId,
    // });

    return {
      data: data.slice(0, query.limit),
      // total,
      hasMore: data.length > query.limit,
    };
  }

  async getUserInfo(userId: number) {
    const [user, totalFriend, totalStar] =
      await Promise.all([
        this.userModel
          .findById(userId)
          .select('username photoUrl partnerType metadata')
          .lean(),
        this.userModel.countDocuments({
          parentId: userId,
        }),
        this.getTotalStars(userId),
      ]);

    const partnerTypeId = user.partnerType === PartnerType.AMBASSADOR && user?.metadata?.realPartnerType !== undefined ? user?.metadata?.realPartnerType : user.partnerType;

    const partner = await this.partnerModel
      .findOne({
        _id: partnerTypeId,
      })
      .select('name');

    return {
      username: user.username,
      photoUrl: user.photoUrl,
      totalFriend,
      totalStar,
      partnerType: partnerTypeId,
      partnerName: partner.name,
    };
  }

  async getHopiumInfo(userId: number) {
    return await this.commissionService.getHopiumCommission(userId);
  }

  @Command({ command: 'update:user:profile', describe: 'Update user profile' })
  async commandSetUserProfile(
    @Option({
      name: 'userId',
      describe: 'userId',
      type: 'number',
    })
    userId: number
  ) {
    if (userId) {
      console.log(`Start update profile user ${userId}...`);
      await this.updateUserProfile(userId);
      console.log(`End update profile user ${userId}`);
    } else {
      console.log('Start reset all user profile...');
      await this.resetDailyTier();
      console.log('End reset all user profile...');
    }
  }

  /**
   * Run at 00:00 UTC on the first day of every month
   * @see https://docs.nestjs.com/techniques/task-scheduling#cron-expression
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { timeZone: 'UTC' })
  async resetDailyTier() {
    try {
      const listUserOpenOrders = await this.orderService.getListUserOpenFutureOrders();
      console.log('listUserOpenOrders', listUserOpenOrders)

      if (listUserOpenOrders.length === 0) {
        this.logger.log('No users open orders found');
        return;
      }

      for (const userId of listUserOpenOrders) {
        const queueName = `${RESET_USER_TIER_QUEUE_NAME}:${userId}`;
        this.resetTierQueue.add(queueName, { userId });
      }

      try {
        await this.userModel.updateMany(
          { _id: { $nin: listUserOpenOrders } },
          { $set: { partnerType: PartnerType.NEWBIE } }
        );

        await this.userProfileModel.updateMany(
          { userId: { $nin: listUserOpenOrders } },
          { $set: {
            winRate7d: 0, profit7d: 0, volume7d: 0,
            winRate30d: 0, profit30d: 0, volume30d: 0,
          }}
        );
      } catch (error) {
        this.logger.error('Error update users to newbie:', error);
      }

      this.logger.log(`Reset daily tier add queue completed.`);
    } catch (error) {
      this.logger.error('Error resetting daily tier:', error);
    }
  }

  @OnEvent(ORDER_EVENTS.CLOSED)
  async handleNewOrderClosed(order: OrderClosedPayload) {
    try {
      const userId = order.user_id;

      const queueName = `${RESET_USER_TIER_QUEUE_NAME}:${userId}`;
      this.resetTierQueue.add(
        queueName,
        { userId },
        { delay: 15 * TIME_MS.SECOND }
      );
    } catch (error) {
      console.error('Error handleNewOrderClosed', error);
    }
  }

  async processUpgradeTier(userId: number) {
    console.log('processUpgradeTier', userId)
    const user = await this.getUserById(userId, true);
    const currentTier = user.partnerType || PartnerType.NEWBIE;

    if (!user) {
      return;
    }

    const partners = await this.partnerModel
      .find({
        _id: { $ne: PartnerType.AMBASSADOR },
      })
      .sort({ _id: 1 });

    // Update user profile and return new calculation profile
    const userProfile = await this.updateUserProfile(userId);
    const volumeInMonth = userProfile.find((item) => item.timeframe === '30d')?.volume;

    if (!partners.length) {
      return;
    }

    let nextPartner;
    for (const partner of partners) {
      // Upgrade tier if satisfy the condition
      if (volumeInMonth >= partner.metadata.accumulatedVolume) {
        nextPartner = partner;
      } else {
        break;
      }
    }

    if (currentTier === PartnerType.AMBASSADOR) {
      await this.userModel.updateOne(
        {
          _id: userId,
        },
        {
          'metadata.realPartnerType': nextPartner._id,
        },
      );
    } else {
      // Update user partner type
      await this.userModel.updateOne(
        {
          _id: userId,
        },
        {
          partnerType: nextPartner._id,
        },
      );

      const success = await this.awardTierReward(
        userId,
        nextPartner._id,
        nextPartner.metadata.rewards,
      );

      if (success) {
        this.chatbotService.sendNoticeTemplate({
          telegramId: user.telegramId,
          templateName: NOTICE_TEMPLATES.UPGRADE_ACCOUNT_TIER,
          params: {
            accountTier: nextPartner.name,
          },
        });
      }
    }
  }

  async awardTierReward(userId: number, tierId: number, tierRewards: Reward[]) {
    try {
      const isClaimReward = await this.userPartnerLogModel.exists({
        userId,
        partnerId: tierId,
        action: 'AWARD',
      });

      if (isClaimReward) {
        return false;
      }

      const awardedReward = [];
      for (const reward of tierRewards) {
        try {
          await this.walletService.changeBalance({
            assetId: reward.assetId,
            category: 44,
            lockedValueChange: 0,
            note: `[Tier] Update tier to ${tierId}`,
            options: '',
            userId: String(userId),
            valueChange: reward.assetQuantity,
          });
          awardedReward.push(reward);
        } catch (error) {
          this.logger.error(
            `Error award tier reward userId(${userId}):`,
            error.message,
          );
        }
      }

      await this.userPartnerLogModel.create({
        userId,
        partnerId: tierId,
        action: 'AWARD',
        metadata: {
          rewards: awardedReward,
        },
      });

      const partner = await this.partnerModel.findOne({ _id: tierId });
      if (partner && awardedReward.length > 0) {
        await this.notificationService.sendAccountTierRewardNotification(
          userId,
          partner.name,
          awardedReward,
          tierId,
        );
      }
    } catch (error) {
      this.logger.error(`Error awardTierReward userId(${userId}):`, error);
      return false;
    }

    return true;
  }

  async _changeBalance(
    amount: number,
    listUsers: number[],
    assetId: Asset,
    note: string,
  ) {
    for (let i = 0; i < listUsers.length; i++) {
      const userId = listUsers[i];
      try {
        const user = await this.userModel.findById(userId);
        if (!user) {
          this.logger.error(`User not found with ID: ${userId}`);
          continue;
        }

        await this.walletService.changeBalance({
          assetId: assetId,
          category: 44, // campaign category
          lockedValueChange: 0,
          note: note,
          options: '',
          userId: String(userId),
          valueChange: amount, // Default
        });
      } catch (e) {
        this.logger.error('Error changeBalance: ' + e.message);
        continue;
      }
    }
  }

  async updateOnboarding(id: number) {
    const user = await this.userModel.findById(id);

    if (!user) {
      throw new BadRequestException(`User with ID ${id} does not exist`);
    }

    try {
      user.isOnboarding = true;
      await user.save();
    } catch (e) {
      this.logger.error('Error transfer commission: ' + e.message);
    }

    return {
      user,
    };
  }

  async getUserInfoAchievement(userId: number) {
    try {
      const user = await this.userModel
        .findOne({ _id: userId })
        .select(
          'username firstName lastName photoUrl followers following isPremium partnerType',
        )
        .lean();

      const partner = await this.partnerModel
        .findOne({
          _id: user?.partnerType,
        })
        .select('name');

      const achievement = await this.orderService.getUserEarnings(userId);
      return {
        ...user,
        partnerName: partner?.name,
        achievement,
      };
    } catch (error) {
      this.logger.error('Error getUserInfoAchievement: ', error);
    }
  }

  async getTotalStars(userId: number) {
    const result = await this.postStarModel.aggregate([
      {
        $match: {
          postAuthorId: userId,
        },
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: '$amount',
          },
        },
      },
    ]);

    return result[0]?.total ?? 0;
  }

  async updateUserProfile(userId: number) {
    try {
      const userProfile = await this.orderService.getUserAchievement(userId, false);
      const userProfile7d = userProfile.find((item) => item.timeframe === '7d');
      const userProfile30d = userProfile.find((item) => item.timeframe === '30d');

      //Update user's winrate and pnl
      await this.userProfileModel.updateOne(
        {
          userId: userId,
        },
        {
          $set: {
            winRate7d: userProfile7d?.winRate,
            profit7d: userProfile7d?.profit,
            volume7d: userProfile7d?.volume,
            roi7d: userProfile7d?.roi,
            winRate30d: userProfile30d?.winRate,
            profit30d: userProfile30d?.profit,
            volume30d: userProfile30d?.volume,
            roi30d: userProfile30d?.roi,
          },
        },
        { upsert: true },
      );

      return userProfile;
    } catch (error) {
      this.logger.error(`Error updateUserProfile: ${userId}`, error);
    }

    return [];
  }
}
