import { Injectable, Logger } from '@nestjs/common';
import { CachePort } from '../application/ports/cache-port';
import { RedisService } from '../../infrastructure/cache/redis/redis.service';

@Injectable()
export class RedisCacheAdapter extends CachePort {
  private readonly logger = new Logger(RedisCacheAdapter.name);

  constructor(private readonly redis: RedisService) {
    super();
  }

  override async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.redis.getCacheManager().get<T>(key);
      return value === undefined || value === null ? undefined : value;
    } catch (error) {
      this.logger.warn(`Cache read failed for ${key}: ${errorMessage(error)}`);
      return undefined;
    }
  }

  override async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    try {
      await this.redis.getCacheManager().set(key, value, ttlMs);
    } catch (error) {
      this.logger.warn(`Cache write failed for ${key}: ${errorMessage(error)}`);
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown cache error';
}
