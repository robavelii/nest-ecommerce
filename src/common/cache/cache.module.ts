import { Module } from "@nestjs/common";
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { CacheInterceptor } from "./cache.interceptor";
import * as redisStore from "cache-manager-ioredis";

@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        store: redisStore,
        ttl: 300,
      }),
    }),
  ],
  providers: [CacheInterceptor],
  exports: [CacheInterceptor],
})
export class CacheModule {}
