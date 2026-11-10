import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, ChannelWrapper } from 'amqp-connection-manager';
import { RabbitMqService } from '../../../../infrastructure/messaging/rabbitmq/rabbitmq.service';
import {
  PaymentQueuePort,
  type PaymentQueueMessage,
} from '../../application/ports/payment-queue.port';
import { PaymentQueueTopology } from './payment-queue.topology';

@Injectable()
export class RabbitPaymentQueue
  extends PaymentQueuePort
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitPaymentQueue.name);
  private channel: ChannelWrapper | undefined;
  private opening: Promise<ChannelWrapper> | undefined;

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly topology: PaymentQueueTopology,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.ensureChannel();
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close();
    this.channel = undefined;
    this.opening = undefined;
  }

  override async publish(message: PaymentQueueMessage): Promise<void> {
    const channel = await this.ensureChannel();
    const names = this.topology.names();
    const published = await channel.publish(
      names.exchange,
      names.routingKey,
      Buffer.from(JSON.stringify(message)),
      {
        persistent: true,
        contentType: 'application/json',
        messageId: message.paymentId,
        timeout: this.config.getOrThrow<number>('payments.queue.publishTimeoutMs'),
      },
    );
    if (!published) {
      throw new Error('Payment message was not accepted by the broker');
    }
  }

  private ensureChannel(): Promise<ChannelWrapper> {
    if (this.channel) return Promise.resolve(this.channel);
    this.opening ??= this.open().catch((error: unknown) => {
      this.opening = undefined;
      throw error;
    });
    return this.opening;
  }

  private async open(): Promise<ChannelWrapper> {
    const channel = this.rabbit.getConnection().createChannel({
      name: 'payment-publisher',
      confirm: true,
      json: false,
      publishTimeout: this.config.getOrThrow<number>('payments.queue.publishTimeoutMs'),
      setup: async (raw: Channel) => {
        await this.topology.assert(raw);
      },
    });
    channel.on('error', (error: unknown) => {
      this.logger.error(
        'Payment publisher channel error',
        error instanceof Error ? error.stack : undefined,
      );
    });
    await channel.waitForConnect();
    this.channel = channel;
    return channel;
  }
}
