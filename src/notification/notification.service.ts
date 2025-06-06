import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Follow } from 'src/follows/schemas/follow.schema';
import { User } from 'src/users/schemas/user.schema';
import {
  NOTIFICATION_QUEUE_NAME,
  NOTIFICATION_QUEUE_EVENT,
  MAX_FOLLOW_AGE_MINUTES,
  MAX_REFERRAL_AGE_MINUTES,
  NOTIFICATION_NAME,
  MAX_STAR_DONATE_AGE_MINUTES,
  CALLER_RECEIVE_RATE,
  STAR_USD_PRICE,
} from './constants/notification.constants';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ReferrerInfo,
  FollowerInfo,
  FollowerContext,
  ReferralContext,
  FuturesCallingContext,
  SendNotiParams,
  FutureOrderUpdatedContext,
} from './types/notification.types';
import { ChatbotService } from 'src/chatbot/chatbot.service';
import { PostOrder } from 'src/feed/schemas/post-order.schema';
import { Post } from 'src/feed/schemas/post.schema';
import { formatVolume, truncateName } from 'src/commons/utils/helper';
import {
  OrderUpdatedPayload,
  OrderClosedPayload,
} from 'src/tasks/type/order.type';
import { OrderService } from 'src/orders/order.service';
import { PostStar } from 'src/feed/schemas/post-star.schema';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { Config, ESConfig } from 'src/configuration/config.interface';
import { OrderType } from 'src/commission/constants/common';
import { OrderStatus } from 'src/orders/constants/order';
import { FutureOrder } from 'src/orders/schemas/future-order.schema';
import { Asset } from 'src/wallets/constants/common';
import { PriceService } from 'src/price/price.service';
import { capitalize } from 'lodash';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectModel(Follow.name) private followModel: Model<Follow>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(PostOrder.name) private postOrderModel: Model<PostOrder>,
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(PostStar.name) private readonly postStarModel: Model<PostStar>,
    @InjectQueue(NOTIFICATION_QUEUE_NAME)
    private notificationQueue: Queue,
    @InjectModel(FutureOrder.name) private futureOrderModel: Model<FutureOrder>,
    private readonly chatbotService: ChatbotService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    private readonly configService: ConfigService<Config>,
    private readonly esService: ElasticsearchService,
    private readonly priceService: PriceService,
  ) {}

  // 30 minutes
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scanFollowerNotifications(): Promise<void> {
    this.logger.log('Scanning for new follower notifications');
    await this.notificationQueue.add(
      NOTIFICATION_QUEUE_EVENT.PROCESS_FOLLOWER_NOTIFICATIONS,
      {},
      {
        jobId: `process_follower_notifications_${Date.now()}`,
      },
    );
  }

  // 30 minutes
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scanReferralNotifications(): Promise<void> {
    this.logger.log('Scanning for new referral notifications');
    await this.notificationQueue.add(
      NOTIFICATION_QUEUE_EVENT.PROCESS_REFERRAL_NOTIFICATIONS,
      {},
      {
        jobId: `process_referral_notifications_${Date.now()}`,
      },
    );
  }

  // 30 minutes
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scanStarDonateNotifications(): Promise<void> {
    await this.notificationQueue.add(
      NOTIFICATION_QUEUE_EVENT.PROCESS_STAR_DONATION_NOTIFICATIONS,
      {},
      {
        jobId: `process_star_donation_notifications_${Date.now()}`,
      },
    );
  }

  @Cron('0 0 0 * * *')
  async scanCommissionReferralsNotifications(): Promise<void> {
    await this.notificationQueue.add(
      NOTIFICATION_QUEUE_EVENT.PROCESS_COMMISSION_REFERRALS_NOTIFICATIONS,
      {},
    );
  }

  @Cron('0 0 0 * * *')
  async scanCommissionShares(): Promise<void> {
    await this.notificationQueue.add(
      NOTIFICATION_QUEUE_EVENT.PROCESS_COMMISSION_SHARES,
      {},
    );
  }

  async sendNoti(params: SendNotiParams): Promise<boolean> {
    try {
      const { userId, template, context } = params;
      await this.chatbotService.sendChatBotNotify({
        template,
        userId,
        context,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to send notification: ${error.message}`);
      return false;
    }
  }

  async processFollowerNotifications(): Promise<void> {
    this.logger.log('Processing all follower notifications');

    const now = moment();
    const maxFollowAge = now
      .clone()
      .subtract(MAX_FOLLOW_AGE_MINUTES, 'minutes')
      .toDate(); // 30 minutes ago

    const findUserFollow = await this.followModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: maxFollowAge,
          },
        },
      },
      {
        $group: {
          _id: '$followingId',
          follows: { $push: '$$ROOT' },
        },
      },
    ]);

    // Xử lý từng nhóm người dùng
    for (const user of findUserFollow) {
      const followingId = user._id;
      const userFollows = user.follows;

      if (userFollows.length === 0) continue;

      const followerIds = userFollows.map((f) => f.followerId);
      const followers = await this.userModel
        .find({
          _id: { $in: followerIds },
        })
        .select('_id username firstName lastName photoUrl')
        .lean();

      const notifications: FollowerInfo[] = [];
      for (const follow of userFollows) {
        const follower = followers.find((f) => f._id === follow.followerId);
        if (!follower) continue;
        notifications.push({
          followerId: follower._id,
          username:
            follower.username !== ''
              ? truncateName(follower.username)
              : truncateName(`${follower.firstName} ${follower.lastName}`),
          photoUrl: follower.photoUrl,
          followTime: follow.createdAt,
        });
      }

      if (notifications.length > 0) {
        await this.sendFollowerNotification(Number(followingId), notifications);
      }
    }
  }

  async processReferralNotifications(): Promise<void> {
    this.logger.log('Processing all referral notifications');

    const now = moment();
    const maxReferralAge = now
      .clone()
      .subtract(MAX_REFERRAL_AGE_MINUTES, 'minutes')
      .toDate(); // 30 minutes ago

    const recentReferrals = await this.userModel
      .find({
        referralDate: { $gte: maxReferralAge },
        parentId: { $exists: true, $ne: null },
      })
      .lean();

    const referralsByParent: Record<string, any[]> = {};
    for (const referral of recentReferrals) {
      if (!referralsByParent[referral.parentId]) {
        referralsByParent[referral.parentId] = [];
      }
      referralsByParent[referral.parentId].push(referral);
    }

    // Xử lý từng nhóm người dùng
    for (const [parentId, userReferrals] of Object.entries(referralsByParent)) {
      if (userReferrals.length === 0) continue;

      // Tạo danh sách thông báo
      const notifications: ReferrerInfo[] = [];
      for (const referral of userReferrals) {
        notifications.push({
          referrerId: referral._id,
          username:
            referral.username !== ''
              ? truncateName(referral.username)
              : truncateName(`${referral.firstName} ${referral.lastName}`),
          photoUrl: referral.photoUrl,
          referralTime: referral.referralDate,
        });
      }

      // Gửi thông báo tổng hợp
      if (notifications.length > 0) {
        await this.sendReferralNotification(Number(parentId), notifications);
      }
    }
  }

  async processStarDonateNotifications(): Promise<void> {
    this.logger.log('Processing star donation notifications');

    const maxStarDonateAge = moment()
      .clone()
      .subtract(MAX_STAR_DONATE_AGE_MINUTES, 'minutes')
      .toDate();

    const recentStars = await this.postStarModel.aggregate([
      {
        $match: {
          createdAt: { $gte: maxStarDonateAge },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $group: {
          _id: {
            postAuthorId: '$postAuthorId',
          },
          uniqueUsers: { $addToSet: '$userId' },
          users: {
            $push: {
              userId: '$userId',
              username: {
                $cond: [
                  { $ne: ['$user.username', ''] },
                  '$user.username',
                  { $concat: ['$user.firstName', ' ', '$user.lastName'] },
                ],
              },
              photoUrl: '$user.photoUrl',
            },
          },
          totalAmount: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          postAuthorId: '$_id.postAuthorId',
          userCount: { $size: '$uniqueUsers' },
          users: 1,
          totalAmount: 1,
        },
      },
    ]);

    const tonPrice = await this.priceService.getSymbolTicker('TONUSDT');
    if (!tonPrice || tonPrice <= 0) {
      this.logger.error('Cannot get TON price for star donation notifications');
      return;
    }

    for (const starGroup of recentStars) {
      const { postAuthorId, users, userCount, totalAmount } = starGroup;

      const tonAmount =
        (STAR_USD_PRICE * totalAmount * CALLER_RECEIVE_RATE) / tonPrice;
      const roundedTonAmount = Number(tonAmount.toFixed(8));
      const convertedAmount = roundedTonAmount;

      if (userCount === 1) {
        const user = users[0];
        const context = {
          username: truncateName(user.username),
          photoUrl: user.photoUrl,
          amount: totalAmount,
          convertedAmount,
          createdAt: new Date().toISOString(),
        };

        await this.sendNoti({
          userId: Number(postAuthorId),
          template: NOTIFICATION_NAME.TIP_STAR,
          context,
        });
      }
      // Nếu có nhiều người tip
      else {
        const username = truncateName(
          users[0].username !== ''
            ? users[0].username
            : `${users[0].firstName} ${users[0].lastName}`,
        );

        const context = {
          username,
          photoUrl: users.map((u) => u.photoUrl),
          total: userCount - 1,
          amount: totalAmount,
          convertedAmount,
          createdAt: new Date().toISOString(),
        };

        await this.sendNoti({
          userId: Number(postAuthorId),
          template: NOTIFICATION_NAME.TIP_STARS,
          context,
        });
      }
    }
  }

  async processCommissionReferralsNotification(): Promise<void> {
    try {
      const today7AM = moment().utc().startOf('day');
      const yesterday7AM = moment().utc().subtract(1, 'days').startOf('day');

      const commissionIndex =
        this.configService.get<ESConfig>('es').index.commission;

      let result;
      try {
        result = await this.esService.search({
          index: commissionIndex,
          size: 0,
          body: {
            query: {
              bool: {
                must: [
                  {
                    range: {
                      created_at: {
                        gte: yesterday7AM.toISOString(),
                        lt: today7AM.toISOString(),
                      },
                    },
                  },
                  {
                    term: {
                      order_type: OrderType.FUTURES,
                    },
                  },
                ],
              },
            },
            aggs: {
              users: {
                terms: {
                  field: 'to_user_id',
                },
                aggs: {
                  commission_sum: {
                    sum: {
                      field: 'commission',
                    },
                  },
                },
              },
            },
          },
        });
      } catch (error) {
        this.logger.error(
          `Error searching commission records: ${error.message}`,
        );
        return;
      }

      const userBuckets = (result.aggregations?.users as any)?.buckets || [];
      if (userBuckets.length === 0) {
        this.logger.log('No commission records found for notification');
        return;
      }

      // Gửi thông báo cho mỗi user
      for (const bucket of userBuckets) {
        const userId = bucket.key;
        const totalAmount = (bucket.commission_sum as any)?.value;

        await this.sendNoti({
          userId: Number(userId),
          template: NOTIFICATION_NAME.COMMISSION_REF,
          context: {
            amount: Number(totalAmount).toFixed(4),
            unit: 'USDT',
            createdAt: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Error processing commission notifications: ${error.message}`,
      );
      throw error;
    }
  }

  async processCommissionShareNotifications(): Promise<void> {
    this.logger.log('Processing commission share notifications');

    const today7AM = moment().utc().startOf('day');
    const yesterday7AM = moment().utc().subtract(1, 'days').startOf('day');

    const indexOrder = this.configService.get<ESConfig>('es').index.order;

    try {
      const result = await this.esService.search({
        index: indexOrder,
        size: 0,
        query: {
          bool: {
            must: [
              { term: { status: OrderStatus.CLOSED } },
              {
                range: {
                  closed_at: {
                    gte: yesterday7AM.toISOString(),
                    lt: today7AM.toISOString(),
                  },
                },
              },
              { exists: { field: 'metadata.caller_user_id' } },
              { range: { share_to_master: { gt: 0 } } },
              { range: { raw_profit: { gt: 0 } } },
            ],
          },
        },
        aggs: {
          caller_groups: {
            terms: {
              field: 'metadata.caller_user_id',
              size: 9999999,
            },
            aggs: {
              total_commission: {
                sum: { field: 'share_to_master' },
              },
            },
          },
        },
      });

      if (
        !(result.aggregations as any)?.caller_groups?.buckets ||
        (result.aggregations as any).caller_groups.buckets.length === 0
      ) {
        this.logger.log('No commission share records found for notification');
        return;
      }

      const closedOrdersWithShareToMaster = (
        result.aggregations as any
      ).caller_groups.buckets.map((bucket) => ({
        _id: bucket.key,
        totalCommission: bucket.total_commission.value,
      }));

      for (const result of closedOrdersWithShareToMaster) {
        const callerId = result._id;
        const totalCommission = result.totalCommission;

        if (Number(totalCommission) > 0) {
          await this.sendNoti({
            userId: Number(callerId),
            template: NOTIFICATION_NAME.COMMISSION_SHARE,
            context: {
              amount: totalCommission,
              unit: 'USDT',
              createdAt: new Date().toISOString(),
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing commission share notifications: ${error.message}`,
        error.stack,
      );
    }
  }

  async sendFollowerNotification(
    userId: number,
    notifications: FollowerInfo[],
  ): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    if (notifications.length === 1) {
      const notification = notifications[0];

      const context: FollowerContext = {
        userId: notification.followerId,
        username: notification.username,
        total: 1,
        photoUrl: notification.photoUrl,
        createdAt: new Date().toISOString(),
      };
      try {
        await this.sendNoti({
          userId,
          template: NOTIFICATION_NAME.NEW_FOLLOWER,
          context,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send NEW_FOLLOWER notification: ${error.message}`,
          error.stack,
        );
      }
    } else {
      const firstFollower = notifications[0];
      const photoUrl = notifications.map((f) => f.photoUrl);

      const context: FollowerContext = {
        userId: firstFollower.followerId,
        username: firstFollower.username,
        total: notifications.length - 1,
        photoUrl,
        createdAt: new Date().toISOString(),
      };

      try {
        await this.sendNoti({
          userId,
          template: NOTIFICATION_NAME.NEW_FOLLOWERS,
          context,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send NEW_FOLLOWERS notification: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  async sendReferralNotification(
    userId: number,
    notifications: ReferrerInfo[],
  ): Promise<void> {
    if (notifications.length === 0) {
      return;
    }

    if (notifications.length === 1) {
      const notification = notifications[0];
      const context: ReferralContext = {
        username: notification.username,
        total: 1,
        photoUrl: notification.photoUrl,
        createdAt: new Date().toISOString(),
      };

      try {
        await this.sendNoti({
          userId,
          template: NOTIFICATION_NAME.NEW_REFFERAL,
          context,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send NEW_REFFERAL notification: ${error.message}`,
          error.stack,
        );
      }
    } else if (notifications.length > 1) {
      const firstReferrer = notifications[0];
      const photoUrl = notifications.map((f) => f.photoUrl);

      const context: ReferralContext = {
        username: firstReferrer.username,
        total: notifications.length - 1,
        photoUrl,
        createdAt: new Date().toISOString(),
      };

      try {
        await this.sendNoti({
          userId,
          template: NOTIFICATION_NAME.NEW_REFFERALS,
          context,
        });
      } catch (error) {
        this.logger.error(
          `Failed to send NEW_REFFERALS notification: ${error.message}`,
          error.stack,
        );
      }
    }
  }

  async sendFuturesCallingNotification(
    user: any,
    postData: {
      id: string;
      symbol: string;
      side: string;
      caption?: string;
      futureOrder?: {
        volume: number;
        open_price?: number;
        leverage?: number;
        tp?: number;
        sl?: number;
      };
    },
  ): Promise<void> {
    try {
      const followers = await this.followModel
        .find({ followingId: user._id })
        .select('followerId')
        .lean();

      if (followers.length === 0) {
        return;
      }

      let percent_tp;
      let percent_sl;

      if (postData.futureOrder?.open_price) {
        const openPrice = postData.futureOrder.open_price;

        if (postData.futureOrder?.tp) {
          const tpPrice = postData.futureOrder.tp;
          let tpPercent = 0;

          if (postData.side.toUpperCase() === 'BUY') {
            tpPercent = ((tpPrice - openPrice) / openPrice) * 100;
          } else {
            tpPercent = ((openPrice - tpPrice) / openPrice) * 100;
          }
          percent_tp = tpPercent.toFixed(2);
        }

        if (!postData.futureOrder?.tp && postData.futureOrder?.sl) {
          const slPrice = postData.futureOrder.sl;
          let slPercent = 0;

          if (postData.side.toUpperCase() === 'BUY') {
            slPercent = ((openPrice - slPrice) / openPrice) * 100;
          } else {
            slPercent = ((slPrice - openPrice) / openPrice) * 100;
          }
          percent_sl = slPercent.toFixed(2);
        }
      }

      const context = {
        caller_name:
          user.username !== ''
            ? user.username
            : `${truncateName(user.firstName)} ${truncateName(user.lastName)}`,
        photoUrl: user.photoUrl,
        postId: postData.id,
        side: postData.side,
        symbol_name: postData.symbol,
        leverage: postData.futureOrder?.leverage,
        price: postData.futureOrder?.open_price,
        volume: postData.futureOrder?.volume,
        createdAt: new Date().toISOString(),
        caller_description: postData.caption,
      };

      if (percent_tp !== undefined) {
        context['percent_tp'] = percent_tp;
      }
      if (percent_sl !== undefined && percent_tp === undefined) {
        context['percent_sl'] = percent_sl;
      }

      // Gửi thông báo cho từng người theo dõi
      const sendPromises = followers.map((follower) => {
        return this.sendNoti({
          userId: follower.followerId,
          template: NOTIFICATION_NAME.FUTURES_CALLING,
          context: {
            ...context,
            userId: user._id,
          } as FuturesCallingContext,
        });
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      this.logger.error(
        `Error in sendFuturesCallingNotification: ${error.message}`,
      );
    }
  }

  async sendVolumeUpdateNotification(
    user: any,
    orderData: {
      id: string | number;
      caption?: string;
      futureOrder?: {
        volumeChangePercent: number;
        originalOrder: any;
      };
      postId?: string;
    },
  ): Promise<void> {
    try {
      const userId = user._id;
      const originalOrderId = orderData.id;
      const volumeChangePercent = formatVolume(
        orderData.futureOrder?.volumeChangePercent || 0,
      );
      const originalOrder = orderData.futureOrder?.originalOrder;

      if (!originalOrder) {
        this.logger.error(
          `Original order data not provided for: ${originalOrderId}`,
        );
        return;
      }

      const queryOrders = await this.postOrderModel
        .find({
          followOrderId: originalOrderId,
          userId: { $ne: userId },
        })
        .select('userId side orderId')
        .lean();

      if (queryOrders.length === 0) {
        return;
      }

      const sendPromises = queryOrders.map(async (copiedOrder) => {
        const copierOrder = await this.orderService.getUserFutureOrder(
          copiedOrder.orderId,
        );

        if (!copierOrder) {
          return null;
        }

        let percent_tp;
        let percent_sl;

        // Tính toán TP/SL từ lệnh gốc
        if (originalOrder?.open_price) {
          const openPrice = originalOrder.open_price;
          if (originalOrder?.tp) {
            const tpPrice = originalOrder.tp;
            let tpPercent = 0;

            if (originalOrder.side.toUpperCase() === 'BUY') {
              tpPercent = ((tpPrice - openPrice) / openPrice) * 100;
            } else {
              tpPercent = ((openPrice - tpPrice) / openPrice) * 100;
            }
            percent_tp = tpPercent.toFixed(2);
          }

          if (!originalOrder?.tp && originalOrder?.sl) {
            const slPrice = originalOrder.sl;
            let slPercent = 0;

            if (originalOrder.side.toUpperCase() === 'BUY') {
              slPercent = ((openPrice - slPrice) / openPrice) * 100;
            } else {
              slPercent = ((slPrice - openPrice) / openPrice) * 100;
            }
            percent_sl = slPercent.toFixed(2);
          }
        }

        const context: FutureOrderUpdatedContext = {
          caller_name:
            user.username !== ''
              ? user.username
              : `${truncateName(user.firstName)} ${truncateName(user.lastName)}`,
          photoUrl: user.photoUrl,
          postId: orderData.postId,
          symbol_name: originalOrder.symbol,
          side: originalOrder.side,
          sidePostOrder: capitalize(copiedOrder.side),
          volume: originalOrder.order_value,
          percent_volume: volumeChangePercent,
          leverage: originalOrder.leverage,
          tp: originalOrder.tp,
          sl: originalOrder.sl,
          price: originalOrder.open_price,
          order: copierOrder,
          createdAt: new Date().toISOString(),
        };

        if (percent_tp !== undefined) {
          context['percent_tp'] = percent_tp;
        }
        if (percent_sl !== undefined && percent_tp === undefined) {
          context['percent_sl'] = percent_sl;
        }

        return this.sendNoti({
          userId: copiedOrder.userId,
          template: NOTIFICATION_NAME.FUTURES_ADD_VOL,
          context,
        });
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      this.logger.error(
        `Error sending volume update notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async sendSlTpUpdateNotification(
    user: any,
    messageData: {
      id: string | number;
      caption?: string;
      futureOrder?: {
        old_tp?: number;
        old_sl?: number;
        new_tp?: number;
        new_sl?: number;
        order?: OrderUpdatedPayload | OrderClosedPayload;
      };
      postId?: string | number;
      caller_description?: string;
    },
  ): Promise<void> {
    try {
      const userId = user._id;
      const originalOrderId = messageData.id;
      const oldSl = messageData.futureOrder?.old_sl;
      const oldTp = messageData.futureOrder?.old_tp;
      const newSl = messageData.futureOrder?.new_sl;
      const newTp = messageData.futureOrder?.new_tp;

      const slChanged =
        newSl !== undefined && oldSl !== undefined && newSl !== oldSl;
      const tpChanged =
        newTp !== undefined && oldTp !== undefined && newTp !== oldTp;

      if (!slChanged && !tpChanged) {
        this.logger.log('No SL/TP changes detected, skipping notification');
        return;
      }

      const queryOrders = await this.postOrderModel
        .find({
          followOrderId: Number(originalOrderId),
          userId: { $ne: userId },
        })
        .select('userId side orderId')
        .lean();

      if (queryOrders.length === 0) {
        return;
      }

      const sendPromises = queryOrders.map(async (copiedOrder) => {
        const userOrder = await this.orderService.getUserFutureOrder(
          copiedOrder.orderId,
        );

        const originalOrder = messageData.futureOrder?.order;

        let percent_tp;
        let percent_sl;
        const openPrice =
          originalOrder?.open_price > 0
            ? originalOrder.open_price
            : originalOrder.price;

        if (openPrice) {
          if (originalOrder?.tp) {
            if (originalOrder.side.toUpperCase() === 'BUY') {
              percent_tp = ((originalOrder.tp - openPrice) / openPrice) * 100;
            } else {
              percent_tp = ((openPrice - originalOrder.tp) / openPrice) * 100;
            }
            percent_tp = percent_tp.toFixed(2);
          }

          if (originalOrder?.sl) {
            if (originalOrder.side.toUpperCase() === 'BUY') {
              percent_sl = ((openPrice - originalOrder.sl) / openPrice) * 100;
            } else {
              percent_sl = ((originalOrder.sl - openPrice) / openPrice) * 100;
            }
            percent_sl = percent_sl.toFixed(2);
          }
        }

        const context: FutureOrderUpdatedContext = {
          caller_name:
            user.username !== ''
              ? user.username
              : `${truncateName(user.firstName)} ${truncateName(user.lastName)}`,
          photoUrl: user.photoUrl,
          postId: messageData.postId,
          symbol_name: originalOrder.symbol,
          side: originalOrder.side,
          sidePostOrder: capitalize(copiedOrder.side),
          volume: originalOrder.order_value,
          leverage: originalOrder.leverage,
          tp: originalOrder.tp,
          sl: originalOrder.sl,
          price: originalOrder.open_price,
          percent_tp,
          percent_sl,
          caller_description: messageData.caller_description,
          order: userOrder,
          createdAt: new Date().toISOString(),
        };

        return this.sendNoti({
          userId: copiedOrder.userId,
          template: NOTIFICATION_NAME.FUTURES_EDIT_TP_SL,
          context,
        });
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      this.logger.error(
        `Failed to send SL/TP update notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async sendFuturesCallingToCopierNotification(payload: {
    user: User;
    postData: {
      id: string;
      caller_description?: string;
      status: string;
    };
    order?: OrderUpdatedPayload | OrderClosedPayload;
  }): Promise<void> {
    try {
      const { user, postData, order } = payload;

      if (!order?.symbol || !order.side || !order.displaying_id) {
        this.logger.log(
          `Missing required data for futures notification: ${JSON.stringify(
            postData,
          )}`,
        );
        return;
      }
      const displayingId = order.displaying_id;
      const notificationStatus = postData.status || 'OPENED';
      let copierCounters: PostOrder[] = [];

      if (notificationStatus === 'CLOSE') {
        copierCounters = await this.postOrderModel
          .find({
            followOrderId: displayingId,
            userId: { $ne: user._id },
          })
          .select('userId side orderId')
          .lean();
      } else {
        copierCounters = await this.postOrderModel.aggregate([
          {
            $match: {
              followOrderId: displayingId,
              userId: { $ne: user._id },
            },
          },
          {
            $group: {
              _id: '$userId',
              userId: { $first: '$userId' },
              orderId: { $first: '$orderId' },
            },
          },
        ]);
      }

      if (copierCounters.length === 0) {
        return;
      }
      // Xác định loại thông báo dựa trên trạng thái order
      let notificationTemplate: NOTIFICATION_NAME;
      switch (notificationStatus) {
        case 'OPENED':
          notificationTemplate = NOTIFICATION_NAME.FUTURE_OPENED_SEND_TO_COPIER;
          break;
        case 'LIQUIDATED':
          notificationTemplate =
            NOTIFICATION_NAME.FUTURE_LIQUIDATE_SEND_TO_COPIER;
          break;
        case 'SL_HIT':
          notificationTemplate = NOTIFICATION_NAME.FUTURE_HIT_SL_SEND_TO_COPIER;
          break;
        case 'TP_HIT':
          notificationTemplate = NOTIFICATION_NAME.FUTURE_HIT_TP_SEND_TO_COPIER;
          break;
        case 'CLOSE':
          notificationTemplate = NOTIFICATION_NAME.FUTURE_CLOSE_SEND_TO_COPIER;
          break;
        default:
          notificationTemplate = NOTIFICATION_NAME.FUTURE_OPENED_SEND_TO_COPIER;
      }

      const sendPromises = copierCounters.map(async (copier) => {
        let copierOrder;

        if (notificationStatus === 'CLOSE') {
          const userOrder = await this.orderService.getUserFutureOrder(
            copier.orderId,
          );
          if (userOrder) {
            copierOrder = userOrder;
          }
        }

        const context: FuturesCallingContext = {
          caller_name:
            user.username !== ''
              ? user.username
              : `${truncateName(user.firstName)} ${truncateName(user.lastName)}`,
          photoUrl: user.photoUrl,
          side: order.side,
          sidePostOrder: capitalize(copier.side),
          symbol_name: order.symbol,
          leverage: order.leverage || 0,
          volume: order.order_value || 0,
          pnl: order.raw_profit || 0,
          caller_description: postData.caller_description || '',
          postId: postData.id,
          userId: user._id,
          createdAt: new Date().toISOString(),
          order: copierOrder,
        };

        return this.sendNoti({
          userId: copier.userId,
          template: notificationTemplate,
          context,
        });
      });

      await Promise.all(sendPromises);
    } catch (error) {
      this.logger.error(
        `Error sending notification to copiers/counters: ${error.message}`,
        error.stack,
      );
    }
  }

  async sendCancelCallingToCopierNotification(
    user: User,
    postData: {
      id: string;
      caption?: string;
      order: OrderClosedPayload;
    },
  ): Promise<void> {
    try {
      const order = postData.order;
      const queryOrders = await this.postOrderModel
        .find({
          followOrderId: Number(order.displaying_id),
          userId: { $ne: user._id },
        })
        .select('userId side orderId')
        .lean();

      if (queryOrders.length === 0) {
        return;
      }

      const sendPromises = queryOrders.map(async (copiedOrder) => {
        const userOrder = await this.orderService.getUserFutureOrder(
          copiedOrder.orderId,
        );

        if (!userOrder) {
          return null;
        }

        let percent_tp;
        let percent_sl;
        const openPrice = order.price;

        if (openPrice) {
          if (order.tp) {
            if (order.side.toUpperCase() === 'BUY') {
              percent_tp = ((order.tp - openPrice) / openPrice) * 100;
            } else {
              percent_tp = ((openPrice - order.tp) / openPrice) * 100;
            }
            percent_tp = percent_tp.toFixed(2);
          }

          if (order.sl && !order.tp) {
            if (order.side.toUpperCase() === 'BUY') {
              percent_sl = ((openPrice - order.sl) / openPrice) * 100;
            } else {
              percent_sl = ((order.sl - openPrice) / openPrice) * 100;
            }
            percent_sl = percent_sl.toFixed(2);
          }
        }

        const context: FuturesCallingContext = {
          caller_name:
            user.username !== ''
              ? user.username
              : `${truncateName(user.firstName)} ${truncateName(user.lastName)}`,
          photoUrl: user.photoUrl,
          side: order.side,
          sidePostOrder: capitalize(copiedOrder.side),
          symbol_name: order.symbol,
          leverage: order.leverage || 0,
          volume: order.order_value || 0,
          postId: postData.id,
          userId: user._id,
          caller_description: postData.caption || '',
          order: userOrder,
          createdAt: new Date().toISOString(),
        };

        if (percent_tp) {
          context['percent_tp'] = percent_tp;
        }
        if (percent_sl && !percent_tp) {
          context['percent_sl'] = percent_sl;
        }

        return this.sendNoti({
          userId: copiedOrder.userId,
          template: NOTIFICATION_NAME.FUTURE_CANCEL_SEND_TO_COPIER,
          context,
        });
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      this.logger.error(
        `Error sending cancel calling to copier notification: ${error.message}`,
      );
    }
  }

  async sendFollowingTpNotification(payload: {
    userId: number;
    postData: {
      id: string;
      caller_description?: string;
      futureOrder?: {
        symbol?: string;
        side?: string;
        leverage?: number;
        volume?: number;
        pnl?: number;
      };
    };
  }): Promise<void> {
    try {
      const { userId, postData } = payload;

      if (!postData.futureOrder?.symbol || !postData.futureOrder.side) {
        this.logger.log(
          `Missing required data for following TP notification: ${JSON.stringify(
            postData,
          )}`,
        );
        return;
      }

      const user = await this.userModel.findOne({ _id: userId });
      if (!user) {
        this.logger.log(
          `User ${userId} not found for following TP notification`,
        );
        return;
      }

      const followers = await this.followModel
        .find({ followingId: userId })
        .select('followerId')
        .lean();

      if (followers.length === 0) {
        this.logger.log(`No followers found for user ${userId}`);
        return;
      }

      // Tạo context cho thông báo
      const context: FuturesCallingContext = {
        caller_name:
          user.username !== ''
            ? user.username
            : `${truncateName(user.firstName)} ${truncateName(user.lastName)}`,
        photoUrl: user.photoUrl,
        side: postData.futureOrder?.side,
        symbol_name: postData.futureOrder?.symbol,
        leverage: postData.futureOrder?.leverage,
        volume: postData.futureOrder?.volume,
        postId: postData.id,
        pnl: postData.futureOrder?.pnl,
        userId,
        caller_description: postData.caller_description || '',
        createdAt: new Date().toISOString(),
      };

      const sendPromises = followers.map((follower) =>
        this.sendNoti({
          userId: Number(follower.followerId),
          template: NOTIFICATION_NAME.FOLLOWING_TP,
          context,
        }),
      );
      await Promise.all(sendPromises);
    } catch (error) {
      this.logger.error(
        `Error sending following TP notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async sendNewCopierNotification(payload: {
    copierId: number;
    followOrderId: number;
    side: string;
  }): Promise<void> {
    try {
      const { copierId, followOrderId, side } = payload;
      const post = await this.postModel.findOne({ orderId: followOrderId });
      if (!post) {
        return;
      }

      const copier = await this.userModel.findOne({ _id: copierId });
      if (!copier) {
        return;
      }

      const context = {
        caller_name:
          copier.username !== ''
            ? copier.username
            : `${truncateName(copier.firstName)} ${truncateName(copier.lastName)}`,
        photoUrl: copier.photoUrl,
        userId: copier._id,
        side: side === 'copy' ? 'copied' : side,
        createdAt: new Date().toISOString(),
      };

      try {
        await this.sendNoti({
          userId: post.userId,
          template: NOTIFICATION_NAME.NEW_COPIER,
          context,
        });
      } catch (notificationError) {
        this.logger.error(
          `Error in sendNoti call: ${notificationError.message}`,
          notificationError.stack,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error sending new copier notification: ${error.message}`,
        error.stack,
      );
    }
  }

  async sendAccountTierRewardNotification(
    userId: number,
    tierName: string,
    rewards: Array<{
      assetId: number;
      assetQuantity: number;
    }>,
    tierId: number,
  ) {
    try {
      const user = await this.userModel.findOne({ _id: userId });
      if (!user) {
        return;
      }

      if (!rewards || rewards.length === 0) {
        rewards = [{ assetId: Asset.USDT, assetQuantity: 0 }];
      }

      const rewardsData = rewards.reduce(
        (acc, reward) => {
          if (reward.assetId === Asset.CUSDT) {
            acc.amountCUsdt = reward.assetQuantity;
          } else if (reward.assetId === Asset.LUSDT) {
            acc.amountLUsdt = reward.assetQuantity;
          }
          return acc;
        },
        { amountCUsdt: 0, amountLUsdt: 0 },
      );
      await this.sendNoti({
        userId,
        template: NOTIFICATION_NAME.RANK_CHANGED,
        context: {
          tierName,
          amountCUsdt: rewardsData.amountCUsdt,
          amountLUsdt: rewardsData.amountLUsdt,
          userType: tierId,
          createdAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      this.logger.error(
        `Error sending account tier reward notification: ${error.message}`,
        error.stack,
      );
    }
  }
}
