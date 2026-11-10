import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type AmqpConnectionManager } from 'amqp-connection-manager';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqService.name);
  private connection: AmqpConnectionManager | undefined;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const url = this.config.getOrThrow<string>('rabbitmq.url');
    const connection = connect([url]);
    connection.on('connectFailed', ({ err }) => {
      this.logger.error('RabbitMQ connection attempt failed', err.stack);
    });
    connection.on('disconnect', ({ err }) => {
      if (err) this.logger.error('RabbitMQ disconnected', err.stack);
    });
    connection.on('error', (error) => {
      this.logger.error('RabbitMQ connection manager error', error.stack);
    });
    this.connection = connection;
    await connection.connect();
  }

  getConnection(): AmqpConnectionManager {
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
