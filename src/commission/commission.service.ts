import { get } from 'lodash';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import { OrderType } from './constants/common';
import { Asset } from '../wallets/constants/common';
import { ORDER_EVENTS } from '../orders/constants/events';
import { Config, ESConfig } from '../configuration/config.interface';
import { PushCommissionDto } from './dto/commission.dto';

import { UsersService } from '../users/users.service';
import { OrderStatus } from "../orders/constants/order";
import { WalletsService } from '../wallets/wallets.service';
import { OrderClosedPayload } from 'src/orders/type/order.type';

@Injectable()
export class CommissionService {
  private readonly logger = new Logger(CommissionService.name);
  protected indexCommission; // index commission
  protected indexOrder; // index order

  constructor(
    private readonly configService: ConfigService<Config>,
    protected readonly esService: ElasticsearchService,
    private readonly walletService: WalletsService,
    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,
  ) {
    this.indexCommission =
      this.configService.get<ESConfig>('es').index.commission;
    this.indexOrder = this.configService.get<ESConfig>('es').index.order;
  }

  pushCommission(data: PushCommissionDto) {
    try {
      return this.esService.index({
        index: this.indexCommission,
        body: {
          from_user_id: data.fromUserId,
          to_user_id: data.toUserId,
          ref_code: data.referralCode,
          ref_id: data.toUserId,
          level: 1,
          commission: data.amount,
          commission_currency: data.assetId,
          order_type: data.type,
          currency: data.assetId,
          created_at: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error pushCommission: ' + error.message);
    }
  }

  //Total referral commission
  async getTotalCommission(userId: number, assetId: number, type: string = '') {
    try {
      const query = [
        {
          match: {
            to_user_id: userId,
          },
        },
        {
          match: {
            commission_currency: assetId,
          },
        },
        ...(type ? [{ match: { order_type: type } }] : []),
      ];

      const result = await this.esService.search({
        index: this.indexCommission,
        query: {
          bool: {
            must: query,
          },
        },
        aggs: {
          total_commission: {
            sum: {
              field: 'commission',
            },
          },
        },
      });
      return get(result, ['aggregations', 'total_commission', 'value'], 0);
    } catch (error) {
      this.logger.error('Error getTotalCommission: ' + error.message);
      return 0;
    }
  }

  //Total call commission
  async getTotalCallCommission(userId: number) {
    try {
      const result = await this.esService.search({
        index: this.indexOrder,
        query: {
          bool: {
            must: [
              {
                match: {
                  'metadata.caller_user_id': userId,
                },
              },
            ],
          },
        },
        aggs: {
          total_commission: {
            sum: {
              field: 'share_to_master',
            },
          },
        },
      });

      return get(result, ['aggregations', 'total_commission', 'value'], 0);
    } catch (error) {
      this.logger.error(
        'Error getCallCommissionShareToMaster: ' + error.message,
      );
      return 0;
    }
  }

  //Total weekly pool from fee
  async getWeeklyPoolRevenue() {
    try {
      const result = await this.esService.search({
        index: this.indexOrder,
        size: 0,
        query: {
          bool: {
            must: [
              {
                match: {
                  _b: false
                }
              },
              {
                match: {
                  fee_currency: Asset.USDT,
                },
              },
              {
                range: {
                  closed_at: {
                    gte: 'now/w',
                    lt: 'now+1w/w',
                  },
                },
              }
            ],
          },
        },
        aggs: {
          total_fee: {
            sum: {
              field: 'fee',
            },
          },
        },
      });
      return get(result, ['aggregations', 'total_fee', 'value'], 0);
    } catch (error) {
      this.logger.error('Error getWeeklyPoolRevenue: ' + error.message);
      return 0;
    }
  }

  //Get user rank from top weekly pool
  async getUserRankWeeklyPool(userId: number) {
    try {
      const result = await this.esService.search({
        index: this.indexOrder,
        query: {
          bool: {
            must: [
              {
                match: {
                  'status': OrderStatus.CLOSED
                }
              },
              {
                range: {
                  'closed_at': {
                    gte: 'now/w',
                    lt: 'now+1w/w',
                    /*"gte": "2025-03-23T00:00:00.000Z",
                    "lt": "2025-03-31T00:00:00.000Z"*/
                  }
                }
              },
            ],
            must_not: [
              {
                match: {
                  'reason_close': 'DCA'
                }
              },
              {
                match: {
                  'open_price': 0
                }
              }
            ]
          },
        },
        aggs: {
          by_user_id: {
            terms: {
              field: 'user_id',
              size: 10,
              order: { total_volume: 'desc' }
            },
            aggs: {
              total_volume: {
                sum: {
                  script: {
                    source: "doc['order_value'].value * 2"
                  }
                }
              }
            }
          }
        }
      });
      const data = get(result, ['aggregations', 'by_user_id', 'buckets'], []);
      if (data.length === 0) {
        return 0;
      }
      const userRank = data.findIndex((item) => item.key === userId);
      return userRank !== -1 ? userRank + 1 : -1;
    } catch (error) {
      this.logger.error('Error getUserRankWeeklyPool: ' + error.message);
      return 0;
    }
  }

  async getListCommission(data: {
    userId: number;
    assetId: number;
    listFriend: number[];
  }) {
    try {
      const result = await this.esService.search({
        index: this.indexCommission,
        query: {
          bool: {
            must: [
              {
                match: {
                  to_user_id: data.userId,
                },
              },
              {
                match: {
                  commission_currency: data.assetId,
                },
              },
              {
                terms: {
                  from_user_id: data.listFriend,
                },
              },
            ],
          },
        },
        aggs: {
          by_commission: {
            terms: {
              field: 'from_user_id',
            },
            aggs: {
              total_commission: {
                sum: {
                  field: 'commission',
                },
              },
            },
          },
        },
      });
      return get(result, ['aggregations', 'by_commission', 'buckets'], []);
    } catch (error) {
      this.logger.error('Error getListCommission: ' + error.message);
      return [];
    }
  }

  async getHopiumCommission(userId: number) {
    try {
      const result = await this.esService.search({
        index: this.indexCommission,
        query: {
          bool: {
            must: [
              {
                match: {
                  to_user_id: userId,
                },
              },
              {
                match: {
                  commission_currency: Asset.HOPIUM,
                },
              },
              {
                terms: {
                  order_type: [
                    OrderType.REFERRAL,
                    OrderType.MISSION,
                    OrderType.VOLUME,
                  ],
                },
              },
            ],
          },
        },
        aggs: {
          by_order_type: {
            terms: {
              field: 'order_type',
            },
            aggs: {
              total_commission: {
                sum: {
                  field: 'commission',
                },
              },
            },
          },
        },
      });
      const hopiumCommission = get(
        result,
        ['aggregations', 'by_order_type', 'buckets'],
        [],
      );

      return {
        volume:
          hopiumCommission.find((item) => item.key === OrderType.VOLUME)
            ?.total_commission?.value || 0,
        mission:
          hopiumCommission.find((item) => item.key === OrderType.MISSION)
            ?.total_commission?.value || 0,
        referral:
          hopiumCommission.find((item) => item.key === OrderType.REFERRAL)
            ?.total_commission?.value || 0,
      };
    } catch (error) {
      this.logger.error('Error getHopiumCommission: ' + error.message);
      return [];
    }
  }

  @OnEvent(ORDER_EVENTS.CLOSED)
  async handleNewOrderClosed(order: OrderClosedPayload) {
    if (order.open_price === 0) {
      this.logger.log(`Skip push commission for order: ${order.displaying_id}`);
      return;
    }

    const userId = order.user_id;
    const volume = order.order_value;
    const orderId = order.displaying_id;

    const commission = this._calculateCommissionOpenOrder(volume);
    const user = await this.userService.getUserById(userId);

    await this.walletService.changeBalance({
      assetId: Asset.HOPIUM,
      category: 2000, // Task category
      lockedValueChange: 0,
      note: `[Commission] Claim commission from order #${orderId}`,
      options: '',
      userId: String(userId),
      valueChange: commission,
    });

    try {
      await this.pushCommission({
        amount: commission,
        fromUserId: userId,
        toUserId: userId,
        referralCode: user.referralCode,
        type: OrderType.VOLUME,
        assetId: Asset.HOPIUM,
      });
    } catch (e) {
      this.logger.error('Error pushCommission: ' + e.message);
    }
  }

  _calculateCommissionOpenOrder(volume: number) {
    return Math.floor(volume);
  }

  async getCallCommissionShareToMaster(listFollowOrderId: number[]) {
    try {
      const listCommission = await this.esService.search({
        index: this.indexOrder,
        size: 0,
        query: {
          bool: {
            must: [
              {
                terms: {
                  'metadata.follow_order_id': listFollowOrderId,
                },
              },
            ],
          },
        },
        aggs: {
          by_follow_order_id: {
            terms: {
              field: 'metadata.follow_order_id',
              size: 10000,
            },
            aggs: {
              total_commission: {
                sum: {
                  field: 'share_to_master',
                },
              },
              commission_bucket_filter: {
                bucket_selector: {
                  buckets_path: {
                    totalCommission: 'total_commission',
                  },
                  script: 'params.totalCommission > 0',
                },
              },
            },
          },
        },
      });
      if (listCommission) {
        return get(
          listCommission,
          ['aggregations', 'by_follow_order_id', 'buckets'],
          [],
        ).map((item) => ({
          order_id: item.key,
          total_commission: item.total_commission.value,
        }));
      }
    } catch (error) {
      this.logger.error(
        'Error getCallCommissionShareToMaster: ' + error.message,
      );
      return [];
    }
  }
}
