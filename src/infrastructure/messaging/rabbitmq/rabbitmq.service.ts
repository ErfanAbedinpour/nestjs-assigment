import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { type ChannelModel } from 'amqplib';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: ChannelModel | undefined;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.getOrThrow<string>('rabbitmq.url');
    this.connection = await amqp.connect(url);
    this.connection.on('error', (error: Error) => {
      this.logger.error('RabbitMQ connection error', error.stack);
    });
  }

  getConnection(): ChannelModel {
    if (!this.connection) {
      throw new Error('RabbitMQ connection is not initialized');
    }
    return this.connection;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }
  }
}
