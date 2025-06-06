import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { BullConfig, Config } from './configuration/config.interface';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import config from './configuration/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksModule } from './tasks/tasks.module';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { BullModule } from '@nestjs/bullmq';
import { redisStore } from 'cache-manager-redis-yet';
import { RedisModule } from './redis/redis.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import { NotificationModule } from './notification/notification.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';

dayjs.extend(utc);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [config] }),
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService<Config>) => ({
        uri: configService.get<string>('mongoUri'),
      }),
      inject: [ConfigService],
    }),
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
    RedisModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 1000,
        limit: 15,
      },
    ]),
    AuthModule,
    TasksModule,
    NotificationModule,
    LeaderboardModule,
  ],
})
class AppModule {}

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);

  const logger = new Logger('bootstrap');

  logger.log(`Scheduler started`);
}

bootstrap();
