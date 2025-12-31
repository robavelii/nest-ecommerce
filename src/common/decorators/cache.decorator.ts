import { SetMetadata } from "@nestjs/common";

export const CACHE_KEY = "cache_key";
export const CACHE_TTL = "cache_ttl";

export const Cache = (key: string, ttl: number = 300) =>
  SetMetadata(CACHE_KEY, { key, ttl });
