import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { WALLET_GRPC_CLIENT_NAME } from './constants/common';
import {
  ChangeBalanceRequest,
  GrpcWalletService, RequestGetWallet,
} from './interfaces/wallet.interface';
import { Metadata } from '@grpc/grpc-js';
import { ConfigService } from '@nestjs/config';
import { Config, GrpcClientConfig } from '../configuration/config.interface';
import { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AssetConfig } from "./schemas/assetconfig.schema";

@Injectable()
export class WalletsService implements OnModuleInit {
  private grpcWalletService: GrpcWalletService;
  private authMetadata = new Metadata();

  constructor(
    private readonly configService: ConfigService<Config>,
    @Inject(WALLET_GRPC_CLIENT_NAME) private client: ClientGrpc,
    @InjectModel(AssetConfig.name)
    private readonly assetConfigModel: Model<AssetConfig>,
  ) {}

  onModuleInit() {
    const grpcClient = this.configService.get<GrpcClientConfig>('grpcClient');
    this.grpcWalletService = this.client.getService<GrpcWalletService>('Wallet');
    this.authMetadata.add('apikey', grpcClient.wallet.authApiKey);
  }

  async getBalance(data: RequestGetWallet) {
    const result = await firstValueFrom(
      this.grpcWalletService.getAvailable(data),
    );

    return {
      userId: data.userId,
      assetId: data.assetId,
      available: result.result,
    };
  }

  async getWallet(data: RequestGetWallet) {
    return await firstValueFrom(
      this.grpcWalletService.getWallet(data),
    );
  }

  async changeBalance(data: ChangeBalanceRequest) {
    return await firstValueFrom(
      this.grpcWalletService.changeBalance(data),
    );
  }

  async getAssetById(id) {
    return await this.assetConfigModel.findOne({ id });
  }
}
