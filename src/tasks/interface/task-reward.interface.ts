import { Asset } from 'src/wallets/constants/common';

export interface TaskReward {
  id: number;
  title: string;
  winningRate: number;
  rewardAsset: Asset;
  rewardQuantity: number;
  maxSpin: number;
}
