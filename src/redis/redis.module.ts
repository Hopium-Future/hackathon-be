import { Global, Module } from '@nestjs/common';
import { RedisCacheProvider } from './redis.provider';

@Global()
@Module({
  providers: [RedisCacheProvider],
  exports: [RedisCacheProvider],
})
export class RedisModule {}
