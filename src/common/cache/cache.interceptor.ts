import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Reflector } from "@nestjs/core";
import { CACHE_KEY } from "../decorators/cache.decorator";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const cacheConfig = this.reflector.get(CACHE_KEY, context.getHandler());
    const request = context.switchToHttp().getRequest();

    if (!cacheConfig) {
      return next.handle();
    }

    const cacheKey = `${cacheConfig.key}:${request.params?.id || request.user?.userId || "all"}`;

    return next.handle().pipe(
      tap({
        next: async (data) => {
          await this.cacheManager.set(cacheKey, data, {
            ttl: cacheConfig.ttl,
          } as any);
          this.logger.debug(`Cached: ${cacheKey}`, "CacheInterceptor");
        },
      }),
    );
  }
}
