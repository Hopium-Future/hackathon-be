import { Observable } from 'rxjs';

export type Wallet = {
  userId: number;
  assetId: number;
  balance: number;
  locked: number;
  available: number;
};

export interface RequestRollback {
  transactions: Transaction[];
}

export interface RequestGetWallet {
  userId: string;
  assetId: number;
  walletType: string;
}

export interface ResponseWalletSingleValue {
  result: number;
}

export interface ResponseWallet {
  value: number;
  lockedValue: number;
  type: number;
}

export interface GenTransactionIdResponse {
  result: string;
}

export interface GenTransactionIdRequest {
  prefix: string;
}

export interface Transaction {
  Id: string;
  V: number;
  assetId: number;
  category: number;
  createdAt: number;
  mainBalance: boolean;
  moneyBefore: number;
  moneyAfter: number;
  moneyUse: number;
  note: string;
  portfolioScanned: boolean;
  updatedAt: number;
  userId: string;
  walletType: string;
  txhash: string;
  /** portfolio */
  transactionId: string;
}

export interface ChangeBalanceRequest {
  userId: string;
  assetId: number;
  valueChange: number;
  lockedValueChange: number;
  category: number;
  note: string;
  options: string;
}

export interface Empty {
}

export interface GrpcWalletService {
  changeBalance(data: ChangeBalanceRequest): Observable<Transaction>;
  genTransactionId(data: GenTransactionIdRequest): Observable<GenTransactionIdResponse>;
  getAvailable(data: RequestGetWallet): Observable<ResponseWalletSingleValue>;
  getLocked(data: RequestGetWallet): Observable<ResponseWalletSingleValue>;
  getBalance(data: RequestGetWallet): Observable<ResponseWalletSingleValue>;
  getWallet(data: RequestGetWallet): Observable<ResponseWallet>;
  rollbackWallet(data: RequestRollback): Observable<Empty>;
}
