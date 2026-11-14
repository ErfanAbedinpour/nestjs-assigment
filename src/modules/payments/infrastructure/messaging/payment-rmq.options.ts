import { ConfigService } from '@nestjs/config';
import { Transport, type RmqOptions, type IncomingEvent } from '@nestjs/microservices';
import { PaymentQueueTopology } from './payment-queue.topology';

export const PAYMENT_RMQ_CLIENT = Symbol('PAYMENT_RMQ_CLIENT');
export const PAYMENT_PROCESS_PATTERN = 'payment.process';

/** Accept deliveries already queued by the previous raw AMQP publisher. */
export class PaymentMessageDeserializer {
  deserialize(value: unknown): IncomingEvent {
    if (typeof value !== 'object' || value === null || !('pattern' in value)) {
      return { pattern: PAYMENT_PROCESS_PATTERN, data: value };
    }
    return value as IncomingEvent;
  }
}

export function paymentRmqOptions(
  config: ConfigService,
  topology: PaymentQueueTopology,
): RmqOptions {
  const names = topology.names();
  return {
    transport: Transport.RMQ,
    options: {
      urls: [config.getOrThrow<string>('rabbitmq.url')],
      queue: names.queue,
      persistent: true,
      prefetchCount: names.prefetch,
      queueOptions: {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-dead-letter-exchange': names.deadLetterExchange,
          'x-dead-letter-routing-key': names.routingKey,
          'x-delivery-limit': names.deliveryLimit,
        },
      },
    },
  };
}
