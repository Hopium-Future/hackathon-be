import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Config } from 'src/configuration/config.interface';

export const REDIS_PROVIDER = {
  CACHE: 'REDIS_CACHE_PROVIDER',
};

export const RedisCacheProvider: Provider = {
  provide: REDIS_PROVIDER.CACHE,
  useFactory: (configService: ConfigService<Config>) => {
    return new Redis(configService.get<string>('redisUri'), {
      keyPrefix: configService.get<string>('redisKeyPrefix') + ':',
    });
  },
  inject: [ConfigService],
};
