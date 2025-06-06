import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from './configuration/config';
import { UsersModule } from './users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import { BullConfig, Config } from './configuration/config.interface';
import { WalletsModule } from './wallets/wallets.module';
import { CommissionModule } from './commission/commission.module';
// import { PriceModule } from './price/price.module';
// import { ScheduleModule } from '@nestjs/schedule';
import { RedisModule } from './redis/redis.module';
import { SocketModule } from './socket/socket.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TasksModule } from './tasks/tasks.module';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { TonModule } from './ton/ton.module';
import { AuthModule } from './auth/auth.module';
import { CommandModule } from 'nestjs-command';
import { ChatbotModule } from './chatbot/chatbot.module';
import { CampaignModule } from './campaign/campaign.module';
import { OrderModule } from './orders/order.module';
import { FollowsModule } from './follows/follows.module';
import { FeedModule } from './feed/feed.module';
import { ProxyModule } from './proxy/proxy.module';
import { StarPaymentModule } from './star-payment/star-payment.module';
import { NotificationModule } from './notification/notification.module';
import { EarnModule } from './earn/earn.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService<Config>) => ({
        uri: configService.get<string>('mongoUri'),
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 1000,
        limit: 15,
      },
    ]),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: (configService: ConfigService<Config>) => ({
        store: redisStore,
        url: configService.get<string>('redisUri'),
        keyPrefix: configService.get<string>('redisKeyPrefix'),
      }),
      inject: [ConfigService],
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService<Config>) => {
        const bullConfig = configService.get<BullConfig>('bull');
        return {
          connection: bullConfig.connection,
          prefix: bullConfig.prefix,
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: true,
          },
        };
      },
      inject: [ConfigService],
    }),
    // ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    RedisModule,
    CommandModule,
    AuthModule,
    UsersModule,
    WalletsModule,
    CommissionModule,
    // PriceModule,
    TasksModule,
    SocketModule,
    TonModule,
    CommandModule,
    ChatbotModule,
    CampaignModule,
    OrderModule,
    FollowsModule,
    FeedModule,
    ProxyModule,
    StarPaymentModule,
    NotificationModule,
    EarnModule,
    LeaderboardModule,
  ],
  controllers: [AppController],
  providers: [
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
  ],
})
export class AppModule {}
