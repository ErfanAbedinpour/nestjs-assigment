import { Controller, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, ConsumeMessage } from 'amqplib';
import { ProcessPaymentCommand } from '../../application/command/process-payment.command';
import { PAYMENT_PROCESS_PATTERN } from './payment-rmq.options';

@Controller()
export class PaymentConsumer implements OnModuleDestroy {
  private readonly logger = new Logger(PaymentConsumer.name);
  private channel: Channel | undefined;
  private consumerTag: string | undefined;
  private readonly inFlight = new Set<Promise<void>>();
  constructor(
    private readonly commands: CommandBus,
    private readonly config: ConfigService,
  ) {}

  @EventPattern(PAYMENT_PROCESS_PATTERN)
  async processPayment(
    @Payload() payload: unknown,
    @Ctx() context: unknown,
  ): Promise<void> {
    const rmq = context as RmqContext;
    const channel = rmq.getChannelRef() as Channel;
    const message = rmq.getMessage() as ConsumeMessage;
    this.channel = channel;
    this.consumerTag = message.fields.consumerTag;
    const work = this.handleMessage(payload, channel, message);
    this.inFlight.add(work);
    try {
      await work;
    } finally {
      this.inFlight.delete(work);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel && this.consumerTag) {
      try {
        await this.channel.cancel(this.consumerTag);
      } catch (error) {
        this.logger.error('Failed to cancel payment consumer', error);
      }
    }
    await Promise.allSettled([...this.inFlight]);
  }

  private async handleMessage(
    payload: unknown,
    channel: Channel,
    message: ConsumeMessage,
  ): Promise<void> {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('paymentId' in payload) ||
      typeof payload.paymentId !== 'string' ||
      payload.paymentId.trim().length === 0
    ) {
      this.logger.error('Discarding a malformed payment message');
      channel.nack(message, false, false);
      return;
    }
    const paymentId = payload.paymentId;
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
