import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-redis/client';
import type { RedisClientType } from 'redis';

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly client: RedisClientType) {}

  getClient(): RedisClientType {
    if (!this.client.isReady) {
      throw new Error('Redis client is not ready');
    }
    return this.client;
  }
}
