import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';

import { FutureOrder } from './schemas/future-order.schema';
import { FutureOrderLog } from './schemas/future-order-log.schema';

import Axios from 'axios';
import * as dayjs from 'dayjs';
import { get } from 'lodash';

import { Config, ESConfig, FuturesServiceConfig, } from 'src/configuration/config.interface';
import { OrderStatus } from './constants/order';
import { OrderPostSide } from 'src/feed/constants/orders';

import { TIME_MS } from '../commons/constants/time';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly futuresOrderService: Axios.AxiosInstance;
  protected indexOrder; // index order

  constructor(
    @InjectModel(FutureOrder.name) private futureOrderModel: Model<FutureOrder>,
    @InjectModel(FutureOrderLog.name)
    private futureOrderLogModel: Model<FutureOrderLog>,
    private readonly configService: ConfigService<Config>,
    protected readonly esService: ElasticsearchService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    const futuresServiceConfig = this.configService.get<FuturesServiceConfig>('futuresService');
    this.futuresOrderService = Axios.create({
      baseURL: futuresServiceConfig.apiBaseUrl,
      timeout: 10000,
      headers: {
        'api-private-key': futuresServiceConfig.apiKey,
      },
    });
    this.indexOrder = this.configService.get<ESConfig>('es').index.order;
  }

  async getUserFutureOrder(orderId: number) {
    const listOrders = await this.getFuturesOrders([orderId].join(','));
    return listOrders[0] ?? null;
  }

  async getFuturesOrders(list_displaying_id: string): Promise<any[]> {
    try {
      const result = await this.futuresOrderService.get('/futures/order', {
        params: {
          list_displaying_id,
        },
      });

      return result?.data?.data ?? [];
    } catch (error) {
      this.logger.error('Error queryOrders: ', error);
    }
  }

  async updateOrderMetadata(data: { displaying_id: number; metadata: object }) {
    return await this.futuresOrderService.put('/futures/order', data);
  }

  async getCopyCounterOrders(callerId: number) {
    const orders = await this.futureOrderModel
      .find({
        'metadata.caller_user_id': { $eq: callerId },
        status: { $ne: OrderStatus.PENDING },
        open_price: { $ne: 0 },
        reason_close: { $ne: 'DCA' },
        opened_at: {
          $gt: dayjs().utc().startOf('day').subtract(30, 'days').toDate(),
        },
      })
      .select('order_value metadata opened_at createdAt')
      .lean();

    const filter7dOrders = orders.filter((order) =>
      dayjs(order.opened_at).isAfter(
        dayjs().utc().subtract(7, 'days').startOf('day'),
      ),
    );
    const copyCounter7d =
      await this._calculateCopyCounterByOrders(filter7dOrders);

    const filter1dOrders = orders.filter((order) =>
      dayjs(order.opened_at).isAfter(
        dayjs().utc().subtract(1, 'days').startOf('day'),
      ),
    );
    const copyCounter1d =
      await this._calculateCopyCounterByOrders(filter1dOrders);

    const copyCounter30d = await this._calculateCopyCounterByOrders(orders);

    return [
      {
        timeframe: '1d',
        copies: copyCounter1d.copies,
        counters: copyCounter1d.counters,
        totalVolume: copyCounter1d.totalVolume,
      },
      {
        timeframe: '7d',
        copies: copyCounter7d.copies,
        counters: copyCounter7d.counters,
        totalVolume: copyCounter7d.totalVolume,
      },
      {
        timeframe: '30d',
        copies: copyCounter30d.copies,
        counters: copyCounter30d.counters,
        totalVolume: copyCounter30d.totalVolume,
      },
    ];
  }

  async _calculateCopyCounterByOrders(orders: any[]) {
    const copies = orders.filter(
      (order) => order.metadata?.side === OrderPostSide.COPY,
    );
    const counters = orders.filter(
      (order) => order.metadata?.side === OrderPostSide.COUNTER,
    );
    const totalVolume = orders.reduce(
      (sum, order) => sum + order.order_value,
      0,
    );

    return {
      copies: copies.length,
      counters: counters.length,
      totalVolume: totalVolume,
    };
  }

  async getLatestOrderLog(orderId: number): Promise<any> {
    try {
      const log = await this.futureOrderLogModel
        .findOne({
          orderId: orderId,
        })
        .sort({ createdAt: -1 })
        .lean();

      if (!log) {
        return null;
      }

      return log;
    } catch (error) {
      this.logger.error(
        `Error getting latest order log for order ${orderId}:`,
        error,
      );
      return null;
    }
  }

  async getUserPosition(userId: number, status: OrderStatus, skip = 0, limit = 10) {
    const result = [];
    const orders = await this.futureOrderModel
      .find({
        user_id: userId,
        status: status,
        open_price: { $ne: 0 }, // filter out orders that have not been opened
        reason_close: { $ne: 'DCA' }, // filter out dca orders
      })
      .select('side symbol leverage open_price close_price order_value margin maintenance_margin quantity profit raw_profit sl tp closed_at createdAt')
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)

    if (orders) {
      for (const order of orders) {
        let liquidated_price = 0;
        if (order.maintenance_margin > 0) {
          const gap_price = (order.margin - order.maintenance_margin) / order.quantity;
          liquidated_price = order.side.toLowerCase() === 'buy' ? order.open_price - gap_price : order.open_price + gap_price;
        }
        result.push({
          side: order.side,
          symbol: order.symbol,
          leverage: order.leverage,
          open_price: order.open_price,
          close_price: order.close_price,
          order_value: order.order_value,
          margin: order.margin,
          liquidated_price: liquidated_price,
          sl: order.sl,
          tp: order.tp,
          profit: order.profit,
          raw_profit: order.raw_profit,
          closed_at: order.closed_at,
          createdAt: order.createdAt,
        });
      }
    }
    return result;
  }

  private _aggsForUserAchievement(day: string) {
    return {
      "filter": day === '30d' ? {
        "bool": {}
      } : {
        "range": {
          "closed_at": {
            gte: `now-${day}/d`
          }
        }
      },
      "aggs": {
        "profit": {
          "sum": {
            "field": "profit"
          }
        },
        "profitOrders": {
          "filter": {
            "range": {
              "profit": {
                "gt": 0
              }
            }
          }
        },
        "margin": {
          "sum": {
            "field": "margin"
          }
        },
        "volume": {
          "sum": {
            "script": {
              "source": "doc['order_value'].value * 2"
            }
          }
        }
      }
    }
  }

  async getUserAchievement(userId: number, isCache = true): Promise<any[]> {
    const cacheKey = `feedUserAchievement_${userId}`;
    const cache = await this.cacheManager.get<Array<any>>(cacheKey);
    if (cache && isCache) {
      return cache;
    }

    const aggs = ['1d', '7d', '30d'].reduce((acc, day) => {
      acc[day] = this._aggsForUserAchievement(day);
      return acc;
    }, {});

    const data = await this.esService.search({
      index: this.indexOrder,
      query: {
        bool: {
          must: [
            {
              match: {
                'user_id': userId
              }
            },
            {
              match: {
                'status': OrderStatus.CLOSED
              }
            },
            {
              range: {
                'closed_at': {
                  gt: dayjs().utc().startOf('day').subtract(30, 'days').toDate()
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
      aggs: aggs
    });
    const orders = get(data, ['aggregations'], [])
    const result = [];
    for (const day of ['1d', '7d', '30d']) {
      const order = get(orders, day, {});
      result.push({
        timeframe: day,
        winRate: order.doc_count > 0 ? order.profitOrders.doc_count / order.doc_count * 100 : 0,
        profit: order.profit.value,
        volume: order.volume.value,
        roi: order.margin.value > 0 ? order.profit.value / order.margin.value * 100 : 0
      })
    }

    if (result) {
      await this.cacheManager.set(cacheKey, result, 10 * TIME_MS.MINUTE);
    }

    return result;
  }

  async getUserEarnings(userId: number) {
    let result = [
      {
        timeframe: '1d',
        winRate: 0,
        roi: 0,
        profit: 0,
        volume: 0,
        copies: 0,
        counters: 0,
      },
      {
        timeframe: '7d',
        winRate: 0,
        roi: 0,
        profit: 0,
        volume: 0,
        copies: 0,
        counters: 0,
      },
      {
        timeframe: '30d',
        winRate: 0,
        roi: 0,
        profit: 0,
        volume: 0,
        copies: 0,
        counters: 0,
      },
    ];

    const achievement = await this.getUserAchievement(userId);
    const copyCounter = await this.getCopyCounterOrders(userId);

    if (achievement) {
      result = achievement.map((item) => {
        const copyCounterItem = copyCounter.find(
          (counter) => counter.timeframe === item.timeframe,
        );

        return {
          ...item,
          copies: copyCounterItem?.copies || 0,
          counters: copyCounterItem?.counters || 0,
          totalVolume: copyCounterItem?.totalVolume || 0,
        };
      });
    }

    return result;
  }

  //Get list users open orders in 30 days
  async getListUserOpenFutureOrders() {
    try {
      const result = await this.esService.search({
        index: this.indexOrder,
        size: 0,
        query: {
          bool: {
            must: [
              {
                range: {
                  createdAt: {
                    gte: dayjs().utc().startOf('day').subtract(30, 'days').toDate(),
                  }
                },
              },
            ],
          },
        },
        aggs: {
          unique_users: {
            terms: {
              field: 'user_id',
              size: 10000,
            },
          },
        }
      });

      return get(result, ['aggregations', 'unique_users', 'buckets'], []).map(item => item.key);
    } catch (error) {
      this.logger.error('Error getListUserOpenFutureOrders: ' + error.message);
      return [];
    }
  }
}
