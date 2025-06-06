import { ExecutionContext, Injectable } from '@nestjs/common';
import { CACHE_KEY_METADATA, CacheInterceptor } from '@nestjs/cache-manager';

@Injectable()
export class UserCacheInterceptor extends CacheInterceptor {
  trackBy(context: ExecutionContext): string | undefined {
    const httpAdapter = this.httpAdapterHost.httpAdapter;
    const isHttpApp = httpAdapter && !!httpAdapter.getRequestMethod;
    const cacheMetadata = this.reflector.get(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );
    const request = context.getArgByIndex(0);
    const userId = request.user?.id;

    if (!userId) return undefined;

    if (!isHttpApp || cacheMetadata) {
      return `${userId}:${cacheMetadata}`;
    }

    if (!this.isRequestCacheable(context)) {
      return undefined;
    }

    return `${userId}:${httpAdapter.getRequestMethod(request)}:${httpAdapter.getRequestUrl(request)}`;
  }
}
