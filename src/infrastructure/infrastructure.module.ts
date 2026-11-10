import { Module } from '@nestjs/common';
import { PrismaModule } from './database/prisma/prisma.module';
import { RabbitMqModule } from './messaging/rabbitmq/rabbitmq.module';
import { RedisModule } from './cache/redis/redis.module';

@Module({
  imports: [PrismaModule, RabbitMqModule, RedisModule],
  exports: [PrismaModule, RabbitMqModule, RedisModule],
})
export class InfrastructureModule {}
