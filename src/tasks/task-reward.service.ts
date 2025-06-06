import Redis from 'ioredis';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_PROVIDER } from 'src/redis/redis.provider';
import { TaskReward } from './interface/task-reward.interface';
import { Asset } from '../wallets/constants/common';

@Injectable()
export class TaskRewardService {
  private currentRewards: TaskReward[];
  private initialRewards: TaskReward[];
  private initSpins = 5000;
  private trade2AirdropTrackKey = 'task:trade2airdrop:track';
  private readonly logger = new Logger(TaskRewardService.name);

  constructor(
    @Inject(REDIS_PROVIDER.CACHE) private readonly redisCache: Redis,
  ) {
    this.initialRewards = [
      {
        id: 1,
        title: '5 TON',
        winningRate: 0.002,
        rewardAsset: Asset.TON,
        rewardQuantity: 5,
        maxSpin: 10,
      },
      {
        id: 2,
        title: '1 TON',
        winningRate: 0.01,
        rewardAsset: Asset.TON,
        rewardQuantity: 1,
        maxSpin: 50,
      },
      {
        id: 3,
        title: '0.5 TON',
        winningRate: 0.02,
        rewardAsset: Asset.TON,
        rewardQuantity: 0.5,
        maxSpin: 100,
      },
      {
        id: 4,
        title: '5000 HOPIUM',
        winningRate: 0.168,
        rewardAsset: Asset.HOPIUM,
        rewardQuantity: 5000,
        maxSpin: 840,
      },
      {
        id: 5,
        title: '1000 HOPIUM',
        winningRate: 0.3,
        rewardAsset: Asset.HOPIUM,
        rewardQuantity: 1000,
        maxSpin: 1500,
      },
      {
        id: 6,
        title: '500 HOPIUM',
        winningRate: 0.5,
        rewardAsset: Asset.HOPIUM,
        rewardQuantity: 500,
        maxSpin: 2500,
      },
    ];

    this.currentRewards = [...this.initialRewards];
  }

  async spin(): Promise<{ rewardAsset: Asset; rewardQuantity: number }> {
    try {
      if ((await this.getTotalSpins()) >= this.initSpins) {
        await this.switchToStableRewards();
      }

      // Filter rewards that have not reached the maximum number of spins
      await this.filterValidRewards();

      // Random reward
      const random = Math.random();
      let totalProbability = 0;

      for (const taskReward of this.currentRewards) {
        totalProbability += taskReward.winningRate;
        if (random <= totalProbability) {
          await this.incrementRemainingSpins(taskReward.id);

          return {
            rewardAsset: taskReward.rewardAsset,
            rewardQuantity: taskReward.rewardQuantity,
          };
        }
      }
    } catch (error) {
      this.logger.error('Error spin reward: ' + error.message);
    }

    const defaultReward = await this.getDefaultReward();
    await this.incrementRemainingSpins(defaultReward.id);

    return {
      rewardAsset: defaultReward.rewardAsset,
      rewardQuantity: defaultReward.rewardQuantity,
    };
  }

  private async switchToStableRewards(): Promise<void> {
    this.currentRewards = [
      {
        id: 7,
        title: '5000 HOPIUM',
        winningRate: 0.17355,
        rewardAsset: Asset.HOPIUM,
        rewardQuantity: 5000,
        maxSpin: 17355,
      },
      {
        id: 8,
        title: '1000 HOPIUM',
        winningRate: 0.30992,
        rewardAsset: Asset.HOPIUM,
        rewardQuantity: 1000,
        maxSpin: 30992,
      },
      {
        id: 9,
        title: '500 HOPIUM',
        winningRate: 0.51653,
        rewardAsset: Asset.HOPIUM,
        rewardQuantity: 500,
        maxSpin: 51653,
      },
    ];
  }

  // Get the total number of spins
  private async getTotalSpins(): Promise<number> {
    const totalSpinsTracked = await this.redisCache.hgetall(
      this.trade2AirdropTrackKey,
    );
    const totalSpins = Object.values(totalSpinsTracked).reduce(
      (acc, curr) => acc + Number(curr),
      0,
    );

    return totalSpins;
  }

  // Increment the number of spins for a reward
  private async incrementRemainingSpins(taskRewardId: number): Promise<void> {
    await this.redisCache.hincrby(
      this.trade2AirdropTrackKey,
      taskRewardId.toString(),
      1,
    );
  }

  // Filter rewards that have not reached the maximum number of spins
  private async filterValidRewards(): Promise<void> {
    const spinsTracked = await this.redisCache.hgetall(
      this.trade2AirdropTrackKey,
    );

    this.currentRewards = this.currentRewards.filter((reward) => {
      return (
        !spinsTracked[reward.id.toString()] ||
        Number(spinsTracked[reward.id.toString()]) < reward.maxSpin
      );
    });
  }

  // Get the default reward if the user has spun all the rewards
  private async getDefaultReward(): Promise<TaskReward> {
    return this.currentRewards[this.currentRewards.length - 1];
  }
}
