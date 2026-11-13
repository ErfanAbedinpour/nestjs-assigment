import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ConsumeMessage } from 'amqplib';
import type { Channel, ChannelWrapper } from 'amqp-connection-manager';
import { RabbitMqService } from '../../../../infrastructure/messaging/rabbitmq/rabbitmq.service';
import { CommandBus } from '@nestjs/cqrs';
import { ProcessPaymentCommand } from '../../application/command/process-payment.command';
import { PaymentQueueTopology } from './payment-queue.topology';

/**
 * Acks a delivery once the payment outcome is durable. If the outcome cannot be
 * recorded, the message is requeued after a delay. A redelivery that finds the
 * payment no longer QUEUED is ignored, and the reconciler repairs a crashed attempt.
 */
@Injectable()
export class PaymentConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PaymentConsumer.name);
  private channel: ChannelWrapper | undefined;

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly topology: PaymentQueueTopology,
    private readonly commands: CommandBus,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const names = this.topology.names();
    const channel = this.rabbit.getConnection().createChannel({
      name: 'payment-consumer',
      confirm: false,
      setup: async (raw: Channel) => {
        await this.topology.assert(raw);
      },
    });
    channel.on('error', (error: unknown) => {
      this.logger.error(
        'Payment consumer channel error',
        error instanceof Error ? error.stack : undefined,
      );
    });
    this.channel = channel;
    await channel.consume(
      names.queue,
      (message) => {
        void this.onMessage(channel, message);
      },
      { noAck: false, prefetch: names.prefetch },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.cancelAll();
    await this.channel?.close();
    this.channel = undefined;
  }

  private async onMessage(
    channel: ChannelWrapper,
    message: ConsumeMessage | null,
  ): Promise<void> {
    if (!message) return;
    const paymentId = readPaymentId(message.content);
    if (paymentId === undefined) {
      this.logger.error('Discarding a malformed payment message');
      channel.nack(message, false, false);
      return;
    }

    try {
      await this.commands.execute(new ProcessPaymentCommand(paymentId));
      channel.ack(message);
    } catch (error) {
      this.logger.error(
        `payment.processing_incomplete paymentId=${paymentId}`,
        error instanceof Error ? error.stack : undefined,
      );
      await delay(this.config.getOrThrow<number>('payments.requeueDelayMs'));
      try {
        channel.nack(message, false, true);
      } catch (nackError) {
        this.logger.error(
          'Failed to requeue a payment message',
          nackError instanceof Error ? nackError.stack : undefined,
        );
      }
    }
  }
}

function readPaymentId(content: Buffer): string | undefined {
  try {
    const parsed: unknown = JSON.parse(content.toString('utf8'));
    if (typeof parsed !== 'object' || parsed === null || !('paymentId' in parsed)) {
      return undefined;
    }
    const paymentId = (parsed as { paymentId?: unknown }).paymentId;
    return typeof paymentId === 'string' && paymentId.length > 0 ? paymentId : undefined;
  } catch {
    return undefined;
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
