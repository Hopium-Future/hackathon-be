import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BotCreatePostDto, CreatePostDto } from './dto/create-post.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Post, PostDocument } from './schemas/post.schema';
import { OrderService } from 'src/orders/order.service';
import { PostReaction } from './schemas/post-reaction.schema';
import {
  GetInvoiceLinkQueryDto,
  QueryFeedDto,
  QueryFeedByIdDto,
} from './dto/query-feed.dto';
import { User } from 'src/users/schemas/user.schema';
import { UserProfile } from 'src/users/schemas/user-profile.schema';
import { PostShare } from './schemas/post-share.schema';
import { OnEvent } from '@nestjs/event-emitter';
import { ORDER_EVENTS } from '../orders/constants/events';
import {
  OrderClosedPayload,
  OrderCreatedPayload,
  OrderUpdatedPayload,
} from '../tasks/type/order.type';
import { ChatbotService } from 'src/chatbot/chatbot.service';
import { CallListType, OrderPostSide } from './constants/orders';
import { PostOrder } from './schemas/post-order.schema';
import { NOTICE_TEMPLATES } from 'src/chatbot/constants/template';
import * as dayjs from 'dayjs';
import { UsersService } from 'src/users/users.service';
import { Reactions } from './constants/reactions';
import {
  PostStar,
  PostStarDocument,
  PostStarTransferCallerStatus,
} from './schemas/post-star.schema';
import { floor, pick } from 'src/commons/utils/helper';
import {
  FEED_QUEUE_EVENT,
  FEED_QUEUE_NAME,
  PostStatus,
} from './constants/posts';
import { OrderStatus } from 'src/orders/constants/order';
import { SocketGateway } from 'src/socket/socket.gateway';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TIME_MS } from 'src/commons/constants/time';
import { Follow } from 'src/follows/schemas/follow.schema';
import { Partner } from 'src/users/schemas/partners.schema';
import { StarPaymentService } from 'src/star-payment/star-payment.service';
import { TransactionType } from 'src/star-payment/constants/transaction-type';
import { STAR_PAYMENT_EVENT } from 'src/star-payment/constants/events';
import { StarTransactionDocument } from 'src/star-payment/schemas/star-transaction.schema';
import { uniq } from '../commons/utils/helper';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { STAR_USD_PRICE } from 'src/star-payment/constants';
import { PriceService } from 'src/price/price.service';
import { Asset } from 'src/wallets/constants/common';
import { WalletsService } from 'src/wallets/wallets.service';
import { PostDescriptionTemplate } from './schemas/post-description-template.schema';
import { NotificationService } from 'src/notification/notification.service';
import { LeaderboardAchievement } from 'src/leaderboard/schemas/leaderboard-achievement.schema';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<Post>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(UserProfile.name) private readonly userProfileModel: Model<UserProfile>,
    @InjectModel(PostShare.name)
    private readonly postShareModel: Model<PostShare>,
    @InjectModel(PostReaction.name)
    private readonly postReactionModel: Model<PostReaction>,
    @InjectModel(PostStar.name)
    private readonly postStarModel: Model<PostStar>,
    @InjectModel(PostOrder.name)
    private readonly postOrderModel: Model<PostOrder>,
    @InjectModel(Follow.name)
    private readonly followModel: Model<Follow>,
    @InjectModel(Partner.name) private partnerModel: Model<Partner>,
    @InjectModel(PostDescriptionTemplate.name)
    private postDescriptionModel: Model<PostDescriptionTemplate>,
    @InjectModel(LeaderboardAchievement.name)
    private leaderboardAchievementModel: Model<LeaderboardAchievement>,
    private readonly orderService: OrderService,
    private readonly chatbotService: ChatbotService,
    private readonly usersService: UsersService,
    private readonly socketGateway: SocketGateway,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly starPaymentService: StarPaymentService,
    @InjectQueue(FEED_QUEUE_NAME)
    private readonly feedQueue: Queue,
    private readonly priceService: PriceService,
    private readonly walletService: WalletsService,
    private readonly notificationService: NotificationService,
  ) {}

  async getFeed(userId: number, query: QueryFeedDto) {
    const posts = await this._queryPosts(userId, query);

    if (!posts.length) {
      return {
        data: [],
        hasMore: false,
      };
    }

    const paramsQueryOrders = posts.map((post) => {
      return post.orderId;
    });

    const orders =
      (
        await this.orderService.getFuturesOrders(paramsQueryOrders.join(','))
      )?.reduce((acc, order) => {
        acc[order.displaying_id] = pick(order, [
          '_id',
          'displaying_id',
          '_b',
          'leverage',
          'margin',
          'margin_currency',
          'metadata',
          'open_price',
          'opened_at',
          'order_value',
          'order_value_currency',
          'origin_order_value',
          'partner_type',
          'price',
          'quantity',
          'fee',
          'side',
          'sl',
          'status',
          'swap',
          'symbol',
          'tp',
          'transfer_quantity',
          'type',
          'updated_at',
          'user_category',
          'user_id',
          'user_metadata',
          'close_order_value',
          'close_price',
          'closed_at',
          'profit',
          'raw_profit',
          'reason_close',
          'reason_close_code',
        ]);

        return acc;
      }, {}) ?? {};

    const postIds = posts.map((post) => post._id.toString());
    const userReactions = await this.queryPostReactions(userId, postIds);

    const uniqueUserIds = uniq(posts.map((post) => post.userId));
    const userFollowings = query.isFollowing
      ? []
      : await this.queryFollowings(userId, uniqueUserIds);

    const partners = await this.queryPartners();

    const result = await Promise.all(
      posts.map(async (post) => {
        const postId = post._id.toString();
        post.id = postId;
        post.futureOrder = orders[post.orderId];

        post.userReact = {
          isLike: userReactions.like.includes(postId),
          isDislike: userReactions.dislike.includes(postId),
          isStar: userReactions.stars.includes(postId),
          isShare: userReactions.shares.includes(postId),
        };

        if (post.user) {
          post.user.isFollowing = query.isFollowing
            ? true
            : userFollowings.includes(post.userId);

          post.user.partnerName = partners.find(
            (partner) => partner._id === post.user.partnerType,
          )?.name;

          const userProfile = await this.orderService.getUserAchievement(
            post.userId,
          );

          post.user.achievement = userProfile;

          const userProfile30d = userProfile.find((item) => item.timeframe === '30d');
          post.user.profit = userProfile30d?.profit ?? 0;
          post.user.winRate = userProfile30d?.winRate ?? 0;
        }

        return post;
      }),
    );

    return {
      data: result.slice(0, query.limit),
      hasMore: result.length > query.limit,
    };
  }

  private async _queryPosts(userId: number, query: QueryFeedDto): Promise<any[]> {
    if (query.isFollowing) {
      return await this.queryFollowingPosts(userId, query);
    }

    return await this.postModel
      .find({ status: { $ne: PostStatus.CANCELLED } })
      .sort('-createdAt')
      .skip(query.offset)
      .populate({
        path: 'user',
        select:
          'username firstName lastName photoUrl followers isPremium partnerType',
      })
      .limit(query.limit + 1)
      .lean()
      .exec();
  }

  async queryPartners() {
    const cacheKey = 'getFeed:queryPartners';
    const cache = await this.cacheManager.get<Array<any>>(cacheKey);

    if (cache) {
      return cache;
    }

    const partners = await this.partnerModel.find().select('name');

    await this.cacheManager.set(cacheKey, partners, 1 * TIME_MS.DAY);

    return partners;
  }

  async queryFollowingPosts(userId: number, query: QueryFeedDto) {
    const followings = await this.followModel
      .find({
        followerId: userId,
      })
      .select('followingId')
      .lean();

    const uniqueFollowingIds = uniq(
      followings.map((following) => following.followingId),
    );

    if (!uniqueFollowingIds.length) {
      return [];
    }

    return await this.postModel
      .find({
        userId: { $in: uniqueFollowingIds },
        status: { $ne: PostStatus.CANCELLED },
      })
      .sort('-createdAt')
      .skip(query.offset)
      .populate({
        path: 'user',
        select:
          'username firstName lastName photoUrl followers isPremium partnerType',
      })
      .limit(query.limit + 1)
      .lean()
      .exec();
  }

  async queryPostReactions(userId: number, postIds: string[]) {
    const [reactions, stars] = await Promise.all([
      this.postReactionModel
        .find({ userId, postId: { $in: postIds } })
        .select('postId reaction'),
      this.postStarModel
        .find({ userId, postId: { $in: postIds } })
        .select('postId'),
    ]);

    const result = {
      like: reactions
        .filter((reaction) => reaction.reaction === Reactions.LIKE)
        .map((reaction) => reaction.postId),
      dislike: reactions
        .filter((reaction) => reaction.reaction === Reactions.DISLIKE)
        .map((reaction) => reaction.postId),
      stars: stars.map((star) => star.postId),
      shares: reactions
        .filter((reaction) => reaction.reaction === Reactions.SHARE)
        .map((reaction) => reaction.postId),
    };

    return result;
  }

  async queryFollowings(userId: number, followingIds: number[]) {
    const followings = await this.followModel
      .find({ followerId: userId, followingId: { $in: followingIds } })
      .select('followingId');

    return followings.map((following) => following.followingId);
  }

  async addQueueCreatePost(userId: number, data: CreatePostDto) {
    await this.feedQueue.add(
      FEED_QUEUE_EVENT.CREATE_POST,
      {
        userId,
        orderId: data.orderId,
        caption: data.caption,
      },
      { delay: 5 * TIME_MS.SECOND },
    );
  }

  async createPost(userId: number, data: CreatePostDto) {
    const futureOrder = await this.orderService.getUserFutureOrder(
      data.orderId,
    );

    if (
      !futureOrder ||
      [OrderStatus.CLOSED, OrderStatus.CLOSING].includes(futureOrder.status)
    ) {
      throw new BadRequestException('Future order not found');
    }

    const existPost = await this.postModel
      .exists({
        orderId: data.orderId,
      })
      .exec();

    if (existPost) {
      throw new BadRequestException('Post already exists');
    }

    const result = await this.postModel.create({
      caption: data.caption,
      orderId: data.orderId,
      userId,
      symbol: futureOrder.symbol,
      side: futureOrder.side,
      status:
        futureOrder.status === OrderStatus.PENDING
          ? PostStatus.PENDING
          : PostStatus.ACTIVE,
    });
    const user = await this.usersService.getUserById(userId);

    try {
      this.orderService.updateOrderMetadata({
        displaying_id: data.orderId,
        metadata: {
          is_share_post: 1,
        },
      });
    } catch (error) {
      console.error('Error updateOrderMetadata:', error);
    }

    // Gửi thông báo cho người theo dõi
    try {
      await this.notificationService.sendFuturesCallingNotification(user, {
        id: result._id.toString(), //id post
        symbol: futureOrder.symbol,
        side: futureOrder.side,
        caption: data.caption,
        futureOrder: {
          volume:
            futureOrder.volume_data?.place_order[Asset.USDT] ??
            futureOrder.volume_data?.place_order[Asset.LUSDT],
          open_price:
            futureOrder.status === OrderStatus.PENDING
              ? futureOrder.price
              : futureOrder.open_price,
          leverage: futureOrder.leverage,
          tp: futureOrder.tp !== null ? futureOrder.tp : 0,
          sl: futureOrder.sl !== null ? futureOrder.sl : 0,
        },
      });
    } catch (error) {
      console.error('Error sending notification:', error.message || error);
    }

    return {
      id: result._id,
      caption: result.caption,
      symbol: result.symbol,
      orderId: result.orderId,
      status: result.status,
      side: result.side,
      profit: result.profit,
      createdAt: result.createdAt,
      futureOrder: {
        side: futureOrder.side,
        status: futureOrder.status,
        leverage: futureOrder.leverage,
        open_price: futureOrder.open_price,
        price: futureOrder.price,
        close_price: futureOrder.close_price,
        tp: futureOrder.tp,
        sl: futureOrder.sl,
        fee: futureOrder.fee,
        quantity: futureOrder.quantity,
        symbol: futureOrder.symbol,
      },
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
      },
    };
  }

  async createReaction(data: {
    userId: number;
    postId: string;
    reaction: string;
  }) {
    const existPost = await this.postModel.exists({
      _id: data.postId,
    });
    if (!existPost) {
      throw new BadRequestException('Post not found');
    }

    const result = await this.postReactionModel.updateOne(
      {
        postId: data.postId,
        userId: data.userId,
        reaction: data.reaction,
      },
      {
        postId: data.postId,
        userId: data.userId,
        reaction: data.reaction,
      },
      {
        upsert: true,
      },
    );

    if (result.upsertedCount === 1) {
      await this.postModel.updateOne(
        { _id: data.postId },
        { $inc: { [`reactions.${data.reaction}`]: 1 } },
      );
    }

    return result;
  }

  async sharePost(userId: number, postId: string) {
    await this.createReaction({
      userId,
      postId,
      reaction: Reactions.SHARE,
    });

    await this.postShareModel.create({
      userId,
      postId,
      refRate: 1,
    });

    return true;
  }

  @OnEvent(ORDER_EVENTS.CREATED)
  async handleOrderCreated(order: OrderCreatedPayload) {
    try {
      this.socketGateway.emitToUser({
        userId: order.user_id,
        event: 'orderCreated',
        data: {
          orderId: order.displaying_id,
        },
      });
    } catch (error) {
      console.error('Error handleOrderUpdated.emitToUser: ', error);
    }

    // Xử lý trường hợp add volume khi có DCA metadata
    if (
      order?.metadata?.dca_order_metadata &&
      order.metadata.dca_order_metadata.is_main_order === false
    ) {
      try {
        // Lấy displaying_id của lệnh gốc
        const originalOrderDisplayingId =
          order.metadata.dca_order_metadata.dca_order[0]?.displaying_id;

        if (originalOrderDisplayingId) {
          // Lấy thông tin lệnh gốc
          const originalOrder = await this.orderService.getUserFutureOrder(
            originalOrderDisplayingId,
          );

          if (!originalOrder) {
            this.logger.error(
              `Original order with displaying_id ${originalOrderDisplayingId} not found`,
            );
            return;
          }

          // Lấy thông tin post từ lệnh gốc
          const post = await this.postModel.findOne({
            orderId: originalOrder.displaying_id,
          });
          if (!post) {
            this.logger.error(
              `Post for order with displaying_id ${originalOrderDisplayingId} not found`,
            );
            return;
          }

          // Lấy thông tin user
          const user = await this.userModel.findOne({ _id: post.userId });
          if (!user) {
            this.logger.error(`User with id ${post.userId} not found`);
            return;
          }

          // Tính toán volume được thêm vào
          const addedVolume =
            order.volume_data?.place_order?.[Asset.LUSDT] ||
            order.volume_data?.place_order?.[Asset.USDT] ||
            0;

          const volumeChangePercent =
            (addedVolume / (originalOrder.order_value - addedVolume)) * 100;

          await this.notificationService.sendVolumeUpdateNotification(user, {
            id: originalOrderDisplayingId,
            caption: post.caption,
            postId: post._id.toString(),
            futureOrder: {
              volumeChangePercent,
              originalOrder,
            },
          });
        }
      } catch (error) {
        this.logger.error(
          `Error processing DCA volume update: ${error.message}`,
        );
      }
    }

    if (order?.metadata?.follow_order_id) {
      try {
        if (order.metadata.side === OrderPostSide.COPY) {
          await this.postModel.findOneAndUpdate(
            { orderId: order.metadata.follow_order_id },
            { $inc: { 'engagement.copies': 1 } },
            { new: true },
          );
        } else if (order.metadata.side === OrderPostSide.COUNTER) {
          await this.postModel.findOneAndUpdate(
            { orderId: order.metadata.follow_order_id },
            { $inc: { 'engagement.counters': 1 } },
            { new: true },
          );
        }

        await this.postOrderModel.create({
          userId: order.user_id,
          orderId: order.displaying_id,
          followOrderId: order.metadata.follow_order_id,
          side: order.metadata.side,
        });

        await this.notificationService.sendNewCopierNotification({
          copierId: order.user_id,
          followOrderId: order.metadata.follow_order_id,
          side: order.metadata.side,
        });
      } catch (error) {
        console.error('Error handleOrderCreated:', error);
      }
    }

    if (order?.metadata?.is_bot === 1) {
      try {
        await this.feedQueue.add(
          FEED_QUEUE_EVENT.CREATE_POST,
          {
            userId: order.user_id,
            orderId: order.displaying_id,
            side: order.side,
            isBot: true,
          },
          { delay: 5 * TIME_MS.SECOND },
        );
      } catch (error) {
        console.error('Error handleOrderCreated.createPost:', error);
      }
    }
  }

  @OnEvent(ORDER_EVENTS.UPDATED)
  async handleOrderUpdated(order: OrderUpdatedPayload) {
    const post = await this.postModel.findOne({ orderId: order.displaying_id });
    if (!post) {
      return;
    }

    const user = await this.userModel.findOne({ _id: post.userId }).lean();
    if (!user) {
      this.logger.warn(`User not found for post ${post._id}`);
      return;
    }

    if (
      order.status === OrderStatus.ACTIVE &&
      post.status === PostStatus.PENDING
    ) {
      try {
        await this.notificationService.sendFuturesCallingToCopierNotification({
          user,
          postData: {
            id: post._id.toString(),
            caller_description: post.caption,
            status: 'OPENED',
          },
          order,
        });
      } catch (error) {
        this.logger.error(
          `Error sending futures calling notification for order #${order.displaying_id}:`,
          error,
        );
      }
    }

    try {
      const postStatus =
        order.status === OrderStatus.ACTIVE ? PostStatus.ACTIVE : post.status;
      if (order.status === OrderStatus.ACTIVE) {
        await post.updateOne({
          $set: {
            status: PostStatus.ACTIVE,
          },
        });
      }

      this.socketGateway.emitToUser({
        userId: post.userId,
        event: 'updatePost',
        data: {
          postId: post._id,
          profit: order.profit,
          tp: order.tp,
          sl: order.sl,
          postStatus: postStatus,
          orderStatus: order.status,
        },
      });
    } catch (error) {
      this.logger.error('Error handleOrderUpdated.emitToUser: ', error);
    }

    // Xử lý gửi thông báo SL/TP
    try {
      const latestOrderLog = await this.orderService.getLatestOrderLog(
        order.displaying_id,
      );

      if (!latestOrderLog) {
        return;
      }

      if (
        latestOrderLog.type === 'MODIFY' &&
        latestOrderLog?.metadata &&
        (latestOrderLog.metadata.modify_sl || latestOrderLog.metadata.modify_tp)
      ) {
        await this.notificationService.sendSlTpUpdateNotification(user, {
          id: order.displaying_id,
          futureOrder: {
            old_tp: latestOrderLog.metadata.modify_tp?.before || null,
            old_sl: latestOrderLog.metadata.modify_sl?.before || null,
            new_tp: order.tp,
            new_sl: order.sl,
            order,
          },
          postId: post._id.toString(),
          caller_description: post.caption,
        });
      }
    } catch (error) {
      this.logger.error(
        `Error sending notification for order #${order.displaying_id}:`,
        error,
      );
    }

    try {
      this._noticeFollowerSignal(
        order,
        post,
        NOTICE_TEMPLATES.FEED_ORDER_UPDATED,
      );
    } catch (error) {
      this.logger.error('Error noticeFollowerSignal: ', error);
    }
  }

  @OnEvent(ORDER_EVENTS.CLOSED)
  async handleOrderClosed(order: OrderClosedPayload) {
    const post = await this.postModel.findOne({ orderId: order.displaying_id });
    if (!post) {
      return;
    }
    const user = await this.userModel.findOne({ _id: post.userId }).lean();
    if (!user) {
      return;
    }

    // Delete post if order is limit & canceled
    if (['Limit', 'Stop'].includes(order.type) && order.open_price === 0) {
      await post.updateOne({
        $set: {
          status: PostStatus.CANCELLED,
        },
      });
      try {
        if (user) {
          try {
            await this.notificationService.sendCancelCallingToCopierNotification(
              user,
              {
                id: post._id.toString(),
                caption: post.caption,
                order,
              },
            );
          } catch (notificationError) {
            this.logger.error(
              `Error sending CANCEL_CALLING_TO_COPIER notification: ${notificationError.message}`,
              notificationError.stack,
            );
          }
        }
      } catch (error) {
        this.logger.error(
          `Error sending cancel notification to copiers: ${error.message}`,
          error.stack,
        );
      }

      return;
    }

    try {
      await post.updateOne({
        $set: {
          status: PostStatus.CLOSED,
          profit: order.profit,
        },
      });

      try {
        this.socketGateway.emitToUser({
          userId: user._id,
          event: 'updatePost',
          data: {
            postId: post._id,
            profit: order.profit,
            tp: order.tp,
            sl: order.sl,
            postStatus: PostStatus.CLOSED,
            orderStatus: order.status,
          },
        });

        let notificationStatus = 'CLOSE';
        if (order.reason_close) {
          switch (order.reason_close) {
            case 'Liquidate':
              notificationStatus = 'LIQUIDATED';
              break;
            case 'Hit SL':
              notificationStatus = 'SL_HIT';
              break;
            case 'Hit TP':
              notificationStatus = 'TP_HIT';
              break;
            default:
              notificationStatus = 'CLOSE';
          }
        }

        try {
          await this.notificationService.sendFuturesCallingToCopierNotification(
            {
              user,
              postData: {
                id: post._id.toString(),
                caller_description: post.caption,
                status: notificationStatus,
              },
              order,
            },
          );
        } catch (notificationError) {
          this.logger.error(
            `Error sending FUTURES_CALLING_TO_COPIER notification: ${notificationError.message}`,
            notificationError.stack,
          );
        }

        if (order.raw_profit > 0) {
          try {
            await this.notificationService.sendFollowingTpNotification({
              userId: user._id,
              postData: {
                id: post._id.toString(),
                caller_description: post.caption,
                futureOrder: {
                  symbol: order.symbol,
                  side: order.side,
                  leverage: order.leverage,
                  volume:
                    order.volume_data?.place_order?.[Asset.USDT] ||
                    order.volume_data?.place_order?.[Asset.LUSDT],
                  pnl: order.raw_profit,
                },
              },
            });
          } catch (error) {
            this.logger.error(
              `Error sending following TP notification for order #${order.displaying_id}:`,
              error,
            );
          }
        }
      } catch (error) {
        this.logger.error('Error handleOrderClosed notifications: ', error);
      }
    } catch (error) {
      this.logger.error('Error update post status: ', error);
    }

    try {
      // Notice to followers signal
      this._noticeFollowerSignal(
        order,
        post,
        NOTICE_TEMPLATES.FEED_ORDER_CLOSED,
      );
    } catch (error) {
      this.logger.error('Error noticeFollowerSignal: ', error);
    }
  }

  private async _noticeFollowerSignal(
    order: OrderCreatedPayload,
    post: PostDocument,
    template: string,
  ) {
    const postOrders = await this.postOrderModel.find({
      followOrderId: order.displaying_id,
    });

    if (!postOrders.length) {
      return;
    }

    const followerIds = postOrders.map((postOrder) => postOrder.userId);

    if (!followerIds.length) {
      return;
    }

    const userMaster = await this.usersService.getUserById(order.user_id);
    const title =
      order.side === 'Buy'
        ? `🟢PUMP ${order.symbol} - ${order.type}`
        : `🔴DUMP ${order.symbol} - ${order.type}`;

    let stoplossPercent = 'N/A';
    if (order.sl) {
      const stoplossPercentNumber =
        order.side === 'Buy'
          ? Math.round(((order.sl - order.open_price) / order.open_price) * 100)
          : Math.round(
              ((order.open_price - order.sl) / order.open_price) * 100,
            );
      stoplossPercent = `${stoplossPercentNumber}%`;
    }

    let targetPercent = 'N/A';
    if (order.tp) {
      const targetPercentNumber =
        order.side === 'Buy'
          ? Math.round(((order.tp - order.open_price) / order.open_price) * 100)
          : Math.round(
              ((order.open_price - order.tp) / order.open_price) * 100,
            );
      targetPercent = `${targetPercentNumber}%`;
    }
    const params = {
      username: userMaster.username || 'master',
      postId: post._id,
      title: title,
      entry: order.open_price,
      stoploss: order.sl || 'N/A',
      stoplossPercent: stoplossPercent,
      target: order.tp || 'N/A',
      targetPercent: targetPercent,
      updatedAt: dayjs().format('DD/MM/YYYY HH:mm:ss'),
    };

    await this._sendMultipleNotice(followerIds, template, params);
  }

  private async _sendMultipleNotice(
    userIds: number[],
    template: string,
    params: any,
  ) {
    const users = await this.userModel
      .find({ _id: { $in: userIds } })
      .select('telegramId');

    users.forEach((user) => {
      this.chatbotService.sendNoticeTemplate({
        telegramId: user.telegramId,
        templateName: template,
        params: params,
      });
    });
  }

  async getInvoiceLink(postId: string, query: GetInvoiceLinkQueryDto) {
    const post = await this.postModel.findById(postId).populate({
      path: 'user',
    });
    if (!post) {
      throw new BadRequestException('Post not found');
    }

    if (!query.resetLink && post.invoiceLinks?.[query.amount]) {
      return {
        invoiceLink: post.invoiceLinks[query.amount],
      };
    }

    const invoiceLink = await this.starPaymentService.createInvoiceLink({
      currency: 'XTR',
      title: 'Send Stars for Caller',
      description:
        'Reward your Callers with Stars and show appreciation for their trades! ✨',
      prices: [
        {
          label: 'Star',
          amount: query.amount,
        },
      ],
      payload: {
        transactionType: TransactionType.POST_STAR,
        postId,
        callerId: post.userId,
      },
    });

    post.invoiceLinks = {
      ...post.invoiceLinks,
      [query.amount]: invoiceLink,
    };

    await post.save();

    return {
      invoiceLink,
    };
  }

  @OnEvent(STAR_PAYMENT_EVENT.SUCCESSFUL_PAYMENT)
  async handleStarPaymentSuccess(transaction: StarTransactionDocument) {
    if (
      transaction.invoicePayload?.transactionType !==
        TransactionType.POST_STAR ||
      !transaction.invoicePayload?.postId
    ) {
      return;
    }
    let postStar: PostStarDocument;
    try {
      const invoicePayload = transaction.invoicePayload;
      postStar = await this.postStarModel.create({
        userId: transaction.userId,
        postId: invoicePayload.postId,
        amount: transaction.totalAmount,
        transactionId: transaction._id,
        postAuthorId: invoicePayload.callerId,
        transferCallerStatus: PostStarTransferCallerStatus.NEW,
      });

      await this.postModel.updateOne(
        { _id: invoicePayload.postId },
        { $inc: { [`engagement.stars`]: postStar.amount } },
      );

      const tonPrice = await this.priceService.getSymbolTicker('TONUSDT');
      if (!tonPrice || tonPrice <= 0) {
        throw new Error('Cannot get TON price');
      }
      // Hardcode receive rate for caller
      const callerReceiveRate = 0.5;

      const callerAmount = floor(
        (STAR_USD_PRICE * postStar.amount * callerReceiveRate) / tonPrice,
        8,
      );

      postStar.callerReceivedAmount = callerAmount;
      postStar.callerReceivedAssetId = Asset.TON;
      postStar.transferCallerStatus = PostStarTransferCallerStatus.PENDING;
      postStar.metadata = {
        tonPrice,
      };
      await postStar.save();

      // Transfer TON to caller

      const result = await this.walletService.changeBalance({
        assetId: Asset.TON,
        category: 44,
        lockedValueChange: 0,
        note: `[Post Star] Receive ${callerAmount} TON from post #${invoicePayload.postId} (${postStar.amount} stars)`,
        options: '',
        userId: invoicePayload.callerId,
        valueChange: callerAmount,
      });

      postStar.transferCallerId = result.transactionId;
      postStar.transferCallerStatus = PostStarTransferCallerStatus.SUCCESS;

      await postStar.save();
      this.logger.log(
        `Post ${invoicePayload.postId} received ${postStar.amount} stars from user ${transaction.userId}`,
      );

      try {
        const caller = await this.usersService.getUserById(
          invoicePayload.callerId,
        );
        this.chatbotService.sendNoticeTemplate({
          telegramId: caller.telegramId,
          templateName: NOTICE_TEMPLATES.FEED_CALLER_RECEIVED_STAR,
          params: {
            callerReceivedAmount: callerAmount,
            callerReceivedAsset: 'TON',
            starAmount: postStar.amount,
            username: transaction.username ?? transaction.telegramUserId,
          },
        });
      } catch (error) {
        this.logger.error('Send Notice Failed: ', error);
      }
    } catch (error) {
      this.logger.error('Error handleStarPaymentSuccess:', error);
      if (postStar) {
        postStar.transferCallerStatus = PostStarTransferCallerStatus.FAILED;
        postStar.transferErrorMessage = error.message;
        await postStar.save();
      }
    }
  }

  async botAutoCreatePost(data: BotCreatePostDto) {
    try {
      let caption = '';
      const { userId, orderId, side } = data;
      const randomCaption = await this.postDescriptionModel.aggregate([
        { $match: { isActive: true, sideApply: { $in: [side, 'All'] } } },
        { $sample: { size: 1 } },
      ]);

      if (randomCaption[0]) {
        await this.postDescriptionModel.updateOne(
          { _id: randomCaption[0]._id },
          { $set: { isActive: false } },
        );
        caption = randomCaption[0].description;
      }

      try {
        await this.createPost(userId, {
          orderId,
          caption,
        });
      } catch (e) {
        this.logger.error(e);

        await this.postDescriptionModel.updateOne(
          { _id: randomCaption[0]._id },
          { $set: { isActive: true } },
        );
      }
    } catch (error) {
      this.logger.error('Error botAutoCreatePost:', error);
    }
  }

  async getFeedByUserId(
    userId: number,
    viewerId: number,
    query: QueryFeedByIdDto,
  ) {
    const queryFilter: any = {
      userId,
      status: { $ne: PostStatus.CANCELLED },
    };

    if (query.type === CallListType.PENDING) {
      queryFilter.status = PostStatus.PENDING;
    } else if (query.type === CallListType.POSITION) {
      queryFilter.status = PostStatus.ACTIVE;
    } else if (query.type === CallListType.CLOSED) {
      queryFilter.status = PostStatus.CLOSED;
    }

    const [posts, counts, user, partners] = await Promise.all([
      this.postModel
        .find(queryFilter)
        .sort('-createdAt')
        .skip(query.offset)
        .limit(query.limit + 1)
        .lean()
        .exec(),
      this.getPostCounts(userId),
      this.userModel
        .findOne({ _id: userId })
        .select(
          'username firstName lastName photoUrl followers isPremium partnerType',
        )
        .lean(),
      this.queryPartners(),
    ]);

    const postIds = posts.map((post) => post._id?.toString()).filter(Boolean);
    const userReactions = await this.queryPostReactions(viewerId, postIds);

    const userProfile = await this.orderService.getUserAchievement(userId);
    const userProfile30d = userProfile.find((item) => item.timeframe === '30d');

    const userInfo = {
      ...user,
      profit: userProfile30d?.profit ?? 0,
      winRate: userProfile30d?.winRate ?? 0,
      partnerName: partners.find((partner) => partner._id === user?.partnerType)?.name,
      achievement: userProfile,
    };

    const paramsQueryOrders = posts.map((post) => post.orderId);

    let orders = {};
    const futuresOrders = await this.orderService.getFuturesOrders(
      paramsQueryOrders.join(','),
    );

    if (futuresOrders) {
      orders = futuresOrders.reduce((acc, order) => {
        acc[order.displaying_id] = pick(order, [
          '_id',
          'displaying_id',
          '_b',
          'leverage',
          'margin',
          'margin_currency',
          'metadata',
          'open_price',
          'opened_at',
          'order_value',
          'order_value_currency',
          'origin_order_value',
          'partner_type',
          'price',
          'quantity',
          'fee',
          'side',
          'sl',
          'status',
          'swap',
          'symbol',
          'tp',
          'transfer_quantity',
          'type',
          'updated_at',
          'user_category',
          'user_id',
          'user_metadata',
          'close_order_value',
          'close_price',
          'closed_at',
          'profit',
          'raw_profit',
          'reason_close',
          'reason_close_code',
        ]);
        return acc;
      }, {});
    }

    const result = posts.map((post: any) => {
      if (!orders[post.orderId]) {
        return null;
      }

      const postId = post._id?.toString();
      const engagement = {
        stars: post.engagement?.stars || 0,
        shares: post.engagement?.shares || 0,
        copies: post.engagement?.copies || 0,
        counters: post.engagement?.counters || 0,
      };

      return {
        ...post,
        user: userInfo,
        id: postId,
        futureOrder: orders[post.orderId],
        engagement,
        userReact: {
          isLike: userReactions.like.includes(postId),
          isDislike: userReactions.dislike.includes(postId),
          isStar: userReactions.stars.includes(postId),
          isShare: userReactions.shares.includes(postId),
        },
      };
    });

    const filteredResult = result.filter((post) => post !== null);

    return {
      data: filteredResult.slice(0, query.limit),
      hasMore: filteredResult.length > query.limit,
      counts,
    };
  }

  async getUserProfile(userId: number, viewerId: number) {
    const userProfile = await this.userModel
      .findOne({ _id: userId })
      .select(
        'username firstName lastName photoUrl followers following isPremium partnerType',
      )
      .lean();

    if (!userProfile) {
      throw new NotFoundException('User not found');
    }

    const isFollowing = !!(await this.followModel.exists({
      followerId: viewerId,
      followingId: userId,
    }));

    const partners = await this.queryPartners();

    return {
      ...userProfile,
      isFollowing,
      partnerName: partners.find(
        (partner) => partner._id === userProfile.partnerType,
      )?.name,
    };
  }

  async getTopStars(userId: number) {
    const topStars = await this.postStarModel.aggregate([
      {
        $match: {
          postAuthorId: userId,
        },
      },
      {
        $group: {
          _id: '$userId',
          totalStars: { $sum: '$amount' },
        },
      },
      {
        $sort: {
          totalStars: -1,
        },
      },
      {
        $limit: 3,
      },
      {
        $lookup: {
          from: 'users',
          let: { userId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$userId'] },
              },
            },
          ],
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          _id: 0,
          userId: '$_id',
          totalStars: 1,
          username: '$user.username',
          firstName: '$user.firstName',
          lastName: '$user.lastName',
          photoUrl: '$user.photoUrl',
        },
      },
    ]);

    return topStars;
  }

  private async getPostCounts(userId: number) {
    const result = await this.postModel
      .aggregate([
        {
          $match: {
            userId: userId,
          },
        },
        {
          $facet: {
            all: [
              {
                $match: {
                  status: { $ne: PostStatus.CANCELLED },
                },
              },
              {
                $count: 'count',
              },
            ],
            pending: [
              {
                $match: {
                  status: PostStatus.PENDING,
                },
              },
              {
                $count: 'count',
              },
            ],
            position: [
              {
                $match: {
                  status: PostStatus.ACTIVE,
                },
              },
              {
                $count: 'count',
              },
            ],
            closed: [
              {
                $match: {
                  status: PostStatus.CLOSED,
                },
              },
              {
                $count: 'count',
              },
            ],
          },
        },
      ])
      .exec();

    return {
      total: result[0].all[0]?.count || 0,
      pending: result[0].pending[0]?.count || 0,
      position: result[0].position[0]?.count || 0,
      closed: result[0].closed[0]?.count || 0,
    };
  }

  async getUserAchievements(userId: number) {
    const achievements = await this.leaderboardAchievementModel
      .find({ userId })
      .lean();
    const trophy = achievements.reduce((acc, achievement) => {
      if (
        achievement.rank <= 3 &&
        (!acc[achievement.type] ||
          acc[achievement.type].rank > achievement.rank)
      ) {
        acc[achievement.type] = {
          rank: achievement.rank,
          counter: achievement.counter,
        };
      }
      return acc;
    }, {});
    const medal = achievements.reduce((acc, achievement) => {
      if (
        achievement.rank > 3 &&
        (!acc[achievement.type] ||
          acc[achievement.type].rank > achievement.rank)
      ) {
        acc[achievement.type] = {
          rank: achievement.rank,
          counter: achievement.counter,
        };
      }
      return acc;
    }, {});

    return {
      trophy,
      medal,
    };
  }
}
