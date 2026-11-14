import { Logger, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createKeyv } from '@keyv/redis';
import { RedisService } from './redis.service';

const logger = new Logger('RedisModule');

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisStore = createKeyv(
          {
            url: config.getOrThrow<string>('redis.url'),
            disableOfflineQueue: true,
            socket: {
              reconnectStrategy: (attempts: number) =>
                Math.min(100 * 2 ** Math.min(attempts, 5), 3000) +
                Math.floor(Math.random() * 100),
            },
          },
          { connectionTimeout: config.getOrThrow<number>('redis.connectionTimeoutMs') },
        );
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
