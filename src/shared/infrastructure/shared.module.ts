import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { RedisModule } from '../../infrastructure/cache/redis/redis.module';
import { CachePort } from '../application/ports/cache-port';
import { Clock } from '../application/ports/clock';
import { IdGenerator } from '../application/ports/id-generator';
import { RandomSource } from '../application/ports/random-source';
import { UnitOfWork } from '../application/ports/unit-of-work';
import { CryptoRandomSource } from './crypto-random-source';
import { PrismaUnitOfWork } from './persistence/prisma-unit-of-work';
import { RedisCacheAdapter } from './redis-cache.adapter';
import { SystemClock } from './system-clock';
import { UuidGenerator } from './uuid-generator';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    PrismaUnitOfWork,
    { provide: UnitOfWork, useExisting: PrismaUnitOfWork },
    SystemClock,
    { provide: Clock, useExisting: SystemClock },
    UuidGenerator,
    { provide: IdGenerator, useExisting: UuidGenerator },
    CryptoRandomSource,
    { provide: RandomSource, useExisting: CryptoRandomSource },
    RedisCacheAdapter,
    { provide: CachePort, useExisting: RedisCacheAdapter },
  ],
  exports: [PrismaUnitOfWork, UnitOfWork, Clock, IdGenerator, RandomSource, CachePort],
})
export class SharedModule {}
