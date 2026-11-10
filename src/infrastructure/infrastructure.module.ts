import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma/prisma.module.js';
import { RabbitMqModule } from './messaging/rabbitmq/rabbitmq.module.js';
import { RedisModule } from './cache/redis/redis.module.js';

@Module({
  imports: [PrismaModule, RabbitMqModule, RedisModule],
  exports: [PrismaModule, RabbitMqModule, RedisModule],
})
export class InfrastructureModule {}
