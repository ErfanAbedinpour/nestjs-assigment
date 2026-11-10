import { Logger, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { RedisService } from './redis.service.js';

const logger = new Logger('RedisModule');

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisStore = createKeyv(config.getOrThrow<string>('redis.url'));
        redisStore.on('error', (error: unknown) => {
          logger.error(
            'Redis store error',
            error instanceof Error ? error.stack : undefined,
          );
        });

        return { stores: [redisStore] };
      },
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
