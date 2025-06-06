import { forwardRef, Module } from '@nestjs/common';
import { CommissionService } from './commission.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Config, ESConfig } from '../configuration/config.interface';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from "@nestjs/elasticsearch";
import { WalletsModule } from "../wallets/wallets.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [
    MongooseModule.forFeature([]),
    ElasticsearchModule.registerAsync({
      useFactory: (configService: ConfigService<Config>) => {
        const esConfig = configService.get<ESConfig>('es');
        return {
          node: esConfig.node,
        };
      },
      inject: [ConfigService],
    }),
    WalletsModule,
    forwardRef(() => UsersModule),
  ],
  controllers: [],
  providers: [CommissionService],
  exports: [CommissionService],
})
export class CommissionModule {}
