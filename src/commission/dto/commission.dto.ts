export class PushCommissionDto {
  fromUserId: number;
  toUserId: number;
  referralCode: string;
  assetId: number;
  amount: number = 0;
  type: string;
}
