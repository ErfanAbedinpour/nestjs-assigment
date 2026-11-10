import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: RedisClientType;

  constructor(config: ConfigService) {
    this.client = createClient({
      url: config.getOrThrow<string>('redis.url'),
    });
    this.client.on('error', (error: Error) => {
      this.logger.error('Redis client error', error.stack);
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  getClient(): RedisClientType {
    if (!this.client.isReady) {
      throw new Error('Redis client is not ready');
    }
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
