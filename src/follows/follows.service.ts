import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Follow } from './schemas/follow.schema';
import { QueryFollowingDto } from './dto/query-following.dto';
import { User } from 'src/users/schemas/user.schema';
import { QueryFollowerDto } from './dto/query-follower.dto';
import { ConfigService } from '@nestjs/config';
import { Config, ESConfig } from '../configuration/config.interface';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { get } from 'lodash';
import { OrderService } from '../orders/order.service';

@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name);
  protected indexUser; // index user

  constructor(
    @InjectModel(Follow.name) private followModel: Model<Follow>,
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly configService: ConfigService<Config>,
    protected readonly esService: ElasticsearchService,
    private readonly orderService: OrderService,
  ) {
    this.indexUser =
      this.configService.get<ESConfig>('es').index.user;
  }

  async follow(followerId: number, followingId: number) {
    if (followerId === followingId) {
      throw new BadRequestException('You cannot follow yourself');
    }

    const existUser = await this.userModel.exists({ _id: followingId });

    if (!existUser) {
      throw new BadRequestException('Following User not found');
    }

    const result = await this.followModel.updateOne(
      {
        followerId,
        followingId,
      },
      {
        followerId,
        followingId,
      },
      {
        upsert: true,
      },
    );

    if (result.upsertedCount === 1) {
      await Promise.all([
        this.userModel.updateOne(
          { _id: followingId },
          { $inc: { followers: 1 } },
        ),
        this.userModel.updateOne(
          { _id: followerId },
          { $inc: { following: 1 } },
        ),
      ]);
    }

    return result;
  }

  async unfollow(followerId: number, followingId: number) {
    const result = await this.followModel.deleteOne({
      followerId,
      followingId,
    });

    if (result.deletedCount === 1) {
      await Promise.all([
        this.userModel.updateOne(
          { _id: followingId },
          { $inc: { followers: -1 } },
        ),
        this.userModel.updateOne(
          { _id: followerId },
          { $inc: { following: -1 } },
        ),
      ]);
    }

    return result;
  }

  async getListFollowing(followerId: number, query: QueryFollowingDto) {
    const result = await this.followModel
      .find({ followerId })
      .sort('-createdAt')
      .skip(query.offset)
      .limit(query.limit + 1);

    const listIds = result
      .slice(0, query.limit)
      .map((item) => item.followingId);

    const hasMore = result.length > query.limit;

    const users = await this.userModel
      .find({ _id: { $in: listIds } })
      .select(
        'username firstName lastName photoUrl followers isPremium',
      )
      .lean();

    const data = [];
    for (const userId of listIds) {
      const user = users.find((user) => user._id === userId);
      if (!user) {
        continue;
      }
      const userProfile = await this.orderService.getUserAchievement(userId);

      const userProfile7d = userProfile.find((item) => item.timeframe === '7d');
      const userProfile30d = userProfile.find((item) => item.timeframe === '30d');

      data.push({
        ...user,
        profit: userProfile30d?.profit ?? 0,
        winRate: userProfile30d?.winRate ?? 0,
        profit7d: userProfile7d?.profit ?? 0,
        winRate7d: userProfile7d?.winRate ?? 0,
      });
    }

    return {
      data,
      hasMore,
    };
  }

  // Get top 10 master with the highest win rate
  async getListFollower() {
    let data = [];
    const result = await this.esService.search({
      index: this.indexUser,
      from: 0,
      size: 10,
      query: {
        bool: {
          must: [
            {
              range: {
                profit30d: {
                  gte: 0,
                }
              }
            }
          ],
        },
      },
      sort: {
        winRate30d: { order: 'desc' },
      }
    });
    const dataQuery = get(result, ['hits', 'hits'], [])?.map(item => {
      return {
        _id: parseInt(item._id),
        followers: item._source?.followers,
        username: item._source?.username,
        firstName: item._source?.firstName,
        lastName: item._source?.lastName,
        winrate: item._source?.winRate30d,
        profit: item._source?.profit30d,
      }
    });

    const listIds = dataQuery?.map((item) => item._id) ?? [];
    const listUsers = await this.userModel
      .find({ _id: { $in: listIds } })
      .select('_id photoUrl isPremium accountType')
      .lean();

    for (const item of dataQuery) {
      const user = listUsers.find((user) => user._id === item._id);
      data.push({
        ...item,
        photoUrl: user?.photoUrl,
        isPremium: user?.isPremium,
        accountType: user?.accountType,
      });
    }

    return data;
  }

  async getListUserFollowing(
    callerId: number,
    followerId: number,
    query: QueryFollowingDto,
  ) {
    const followings = await this.followModel
      .find({ followerId })
      .sort('-createdAt')
      .skip(query.offset)
      .limit(query.limit + 1);

    const followingIds = followings
      .slice(0, query.limit)
      .map((item) => item.followingId);

    // Get user followings to check if the current user is following the followings
    const userFollowings = await this.followModel
      .find({
        followerId: callerId,
        followingId: { $in: followingIds },
      })
      .select('followingId');
    const userIds = userFollowings.map((item) => item.followingId);

    const users = await this.userModel
      .find({ _id: { $in: followingIds } })
      .select(
        'username firstName lastName photoUrl followers isPremium',
      )
      .lean();

    const data = [];
    for (const userId of followingIds) {
      const user = users.find((user) => user._id === userId);
      if (!user) {
        continue;
      }
      const userProfile = await this.orderService.getUserAchievement(userId);
      const userProfile7d = userProfile.find((item) => item.timeframe === '7d');
      const userProfile30d = userProfile.find((item) => item.timeframe === '30d');

      data.push({
        ...user,
        isFollowing: userIds.includes(user._id),
        profit: userProfile30d?.profit ?? 0,
        winRate: userProfile30d?.winRate ?? 0,
        profit7d: userProfile7d?.profit ?? 0,
        winRate7d: userProfile7d?.winRate ?? 0,
      });
    }

    return {
      data,
      hasMore: followings.length > query.limit,
    };
  }

  async getListUserFollower(
    callerId: number,
    userId: number,
    query: QueryFollowerDto,
  ) {
    const followers = await this.followModel
      .find({ followingId: userId })
      .sort('-createdAt')
      .skip(query.offset)
      .limit(query.limit + 1);

    const followerIds = followers
      .slice(0, query.limit)
      .map((item) => item.followerId);

    // Get user followings to check if the user is following the followers
    const userFollowings = await this.followModel
      .find({
        followerId: callerId,
        followingId: { $in: followerIds },
      })
      .select('followingId');
    const userFollowingFollowerIds = userFollowings.map(
      (item) => item.followingId,
    );

    const users = await this.userModel
      .find({ _id: { $in: followerIds } })
      .select(
        'username firstName lastName photoUrl followers isPremium',
      )
      .lean();

    const data = [];
    for (const userId of followerIds) {
      const user = users.find((user) => user._id === userId);
      if (!user) {
        continue;
      }

      const userProfile = await this.orderService.getUserAchievement(userId);
      const userProfile7d = userProfile.find((item) => item.timeframe === '7d');
      const userProfile30d = userProfile.find((item) => item.timeframe === '30d');

      data.push({
        ...user,
        isFollowing: userFollowingFollowerIds.includes(user._id),
        profit: userProfile30d?.profit ?? 0,
        winRate: userProfile30d?.winRate ?? 0,
        profit7d: userProfile7d?.profit ?? 0,
        winRate7d: userProfile7d?.winRate ?? 0,
      });
    }

    return {
      data,
      hasMore: followers.length > query.limit,
    };
  }

  async getListUserRecommendFollowing(userId: number) {
    let data = [];
    const followers = await this.followModel
      .find({ followerId: userId })

    const followingsIds = followers
      .map((item) => item.followingId);

    const result = await this.esService.search({
      index: this.indexUser,
      from: 0,
      size: 10,
      query: {
        bool: {
          must: [
            {
              range: {
                profit30d: {
                  gte: 0,
                }
              }
            }
          ],
          must_not: [
            {
              terms: {
                userId: followingsIds,
              }
            }
          ]
        },
      },
      sort: {
        winRate30d: { order: 'desc' },
      }
    });
    const dataQuery = get(result, ['hits', 'hits'], [])?.map(item => {
      return {
        _id: parseInt(item._id),
        followers: item._source?.followers,
        username: item._source?.username,
        firstName: item._source?.firstName,
        lastName: item._source?.lastName,
        winrate: item._source?.winRate30d,
        profit: item._source?.profit30d,
      }
    });

    const listIds = dataQuery?.map((item) => item._id) ?? [];
    const listUsers = await this.userModel
      .find({ _id: { $in: listIds } })
      .select('_id photoUrl isPremium accountType')
      .lean();

    for (const item of dataQuery) {
      const user = listUsers.find((user) => user._id === item._id);
      data.push({
        ...item,
        photoUrl: user?.photoUrl,
        isPremium: user?.isPremium,
        accountType: user?.accountType,
      });
    }

    return data;
  }

  async searchUser(userId: number, keyword: string) {
    let data = [];
    try {
      keyword = keyword.replace(/[^a-zA-Z0-9\s_]/g, '').trim();

      if (keyword) {
        const query = [
          {
            query_string: {
              fields: [
                "username.folded",
              ],
              query: `*${keyword}*`
            }
          },
          ...(parseInt(keyword) ? [{ term: { userId: parseInt(keyword) } }] : []),
        ];
        const result = await this.esService.search({
          index: this.indexUser,
          from: 0,
          size: 5,
          query: {
            bool: {
              should: query,
            },
          },
          sort: {
            winRate30d: { order: 'desc' },
          }
        });
        const listIds = get(result, ['hits', 'hits'], [])?.map((item) => parseInt(item._id));

        if (listIds) {
          // Get user followings to check if the user is following the followers
          const userFollowings = await this.followModel
            .find({
              followerId: userId,
              followingId: { $in: listIds },
            })
            .select('followingId');
          const userFollowingFollowerIds = userFollowings.map(
            (item) => item.followingId,
          );
          //To prevent following yourself
          userFollowingFollowerIds.push(userId);

          const users = await this.userModel
            .find({ _id: { $in: listIds } })
            .select(
              'username firstName lastName photoUrl followers isPremium',
            )
            .lean();

          for (const user of users) {
            const userProfile = await this.orderService.getUserAchievement(user._id);

            const userProfile7d = userProfile.find((item) => item.timeframe === '7d');
            const userProfile30d = userProfile.find((item) => item.timeframe === '30d');

            data.push({
              ...user,
              isFollowing: userFollowingFollowerIds.includes(user._id),
              profit: userProfile30d?.profit ?? 0,
              winRate: userProfile30d?.winRate ?? 0,
              profit7d: userProfile7d?.profit ?? 0,
              winRate7d: userProfile7d?.winRate ?? 0,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error query search user: ' + error.message);
      return [];
    }

    return {
      data,
      hasMore: false,
    };
  }
}
