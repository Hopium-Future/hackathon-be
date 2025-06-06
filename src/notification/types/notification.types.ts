import {
  OrderClosedPayload,
  OrderCreatedPayload,
} from 'src/orders/type/order.type';
import { OrderUpdatedPayload } from 'src/tasks/type/order.type';

export interface NotiTemplate {
  name: string;
  group: string;
  title?: Record<string, string>;
  content?: Record<string, string>;
  status: number;
  params?: any[];
  screenTo?: string;
}

export interface NotiMessage {
  type: string;
  context: Record<string, any>;
}

export interface FollowerInfo {
  followerId: number;
  username: string;
  photoUrl: string;
  followTime: Date;
}

export interface ReferrerInfo {
  referrerId: string | number;
  username: string;
  photoUrl: string;
  referralTime: Date;
}

export interface FollowerContext {
  userId: number;
  username: string;
  total: number;
  photoUrl: string[] | string;
  createdAt: string;
}

export interface ReferralContext {
  username: string;
  total: number;
  photoUrl: string[] | string;
  createdAt: string;
}

export interface AccountTierRewardContext {
  userId: number;
  tierName: string;
  rewards: Array<{
    assetId: number;
    assetQuantity: number;
  }>;
  createdAt: string;
}

export interface GetTemplateParams {
  name: string;
  group: string;
}

export interface CreateFromTemplateParams {
  templateName: string;
  context: Record<string, any>;
  language?: string;
}

export interface SendFollowerNotiParams {
  userId: number;
  notifications: FollowerInfo[];
}

export interface SendReferralNotiParams {
  userId: number;
  notifications: ReferrerInfo[];
}

export interface SendNotiParams {
  userId: number;
  template: string;
  context: Record<string, any>;
}

export interface FuturesCallingContext {
  caller_name: string;
  photoUrl: string;
  side?: string;
  sidePostOrder?: string;
  symbol_name: string;
  leverage: number;
  volume: number;
  pnl?: number;
  postId?: string | number;
  userId: number;
  createdAt: string;
  price?: number;
  percent_tp?: number | string;
  percent_sl?: number | string;
  caller_description?: string;
  order?: OrderUpdatedPayload | OrderClosedPayload;
}

export interface FutureAddVolumeContext {
  username: string;
  photoUrl: string;
  postId: string | number;
  symbol: string;
  side: 'BUY' | 'SELL';
  volume: number;
  oldVolume?: number;
  leverage: number;
  takeProfit?: number;
  stopLoss?: number;
  createdAt?: string;
}

export interface FutureOrderUpdatedContext {
  caller_name: string;
  photoUrl?: string;
  postId?: string | number;
  symbol_name: string;
  side: string;
  sidePostOrder: string;
  volume?: number;
  percent_volume?: number | string;
  leverage?: number;
  tp?: number;
  sl?: number;
  price?: number;
  percent_sl?: number | string;
  percent_tp?: number | string;
  percent?: number | string;
  order?: OrderCreatedPayload | OrderUpdatedPayload | OrderClosedPayload;
  caller_description?: string;
  createdAt: string;
}
