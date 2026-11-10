import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel } from 'amqp-connection-manager';

export type PaymentQueueNames = {
  exchange: string;
  queue: string;
  routingKey: string;
  deadLetterExchange: string;
  deadLetterQueue: string;
  deliveryLimit: number;
  prefetch: number;
};

@Injectable()
export class PaymentQueueTopology {
  constructor(private readonly config: ConfigService) {}

  names(): PaymentQueueNames {
    return {
      exchange: this.config.getOrThrow<string>('payments.queue.exchange'),
      queue: this.config.getOrThrow<string>('payments.queue.queue'),
      routingKey: this.config.getOrThrow<string>('payments.queue.routingKey'),
      deadLetterExchange: this.config.getOrThrow<string>(
        'payments.queue.deadLetterExchange',
      ),
      deadLetterQueue: this.config.getOrThrow<string>('payments.queue.deadLetterQueue'),
      deliveryLimit: this.config.getOrThrow<number>('payments.queue.deliveryLimit'),
      prefetch: this.config.getOrThrow<number>('payments.queue.prefetch'),
    };
  }

  /** Declared by both the publisher and the consumer so either process can start first. */
  async assert(channel: Channel): Promise<void> {
    const names = this.names();
    await channel.assertExchange(names.exchange, 'direct', { durable: true });
    await channel.assertExchange(names.deadLetterExchange, 'direct', { durable: true });
    await channel.assertQueue(names.deadLetterQueue, { durable: true });
    await channel.bindQueue(
      names.deadLetterQueue,
      names.deadLetterExchange,
      names.routingKey,
    );
    await channel.assertQueue(names.queue, {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-dead-letter-exchange': names.deadLetterExchange,
        'x-dead-letter-routing-key': names.routingKey,
        'x-delivery-limit': names.deliveryLimit,
      },
    });
    await channel.bindQueue(names.queue, names.exchange, names.routingKey);
  }
}
