import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { RabbitMqService } from '../../../../../infrastructure/messaging/rabbitmq/rabbitmq.service';
import { PaymentQueueTopology } from '../payment-queue.topology';
import { RabbitPaymentQueue } from '../rabbit-payment-queue';

describe('payment queue', () => {
  const values: Record<string, string | number> = {
    'payments.queue.exchange': 'ex',
    'payments.queue.queue': 'queue',
    'payments.queue.routingKey': 'route',
    'payments.queue.deadLetterExchange': 'dlx',
    'payments.queue.deadLetterQueue': 'dlq',
    'payments.queue.deliveryLimit': 5,
    'payments.queue.prefetch': 2,
    'payments.queue.publishTimeoutMs': 1000,
  };
  const config = { getOrThrow: (key: string) => values[key] } as unknown as ConfigService;
  it('declares durable queues and dead letter routing', async () => {
    const channel = { assertExchange: vi.fn(), assertQueue: vi.fn(), bindQueue: vi.fn() };
    await new PaymentQueueTopology(config).assert(channel as never);
    expect(channel.assertQueue).toHaveBeenCalledWith(
      'queue',
      expect.objectContaining({
        arguments: expect.objectContaining({
          'x-queue-type': 'quorum',
          'x-delivery-limit': 5,
        }),
      }),
    );
    expect(channel.bindQueue).toHaveBeenCalledWith('dlq', 'dlx', 'route');
  });

  it('publishes persistent messages and rejects broker refusals', async () => {
    const channel = {
      on: vi.fn(),
      waitForConnect: vi.fn(),
      publish: vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false),
      close: vi.fn(),
    };
    const createChannel = vi.fn().mockReturnValue(channel);
    const rabbit = {
      getConnection: () => ({ createChannel }),
    } as unknown as RabbitMqService;
    const queue = new RabbitPaymentQueue(
      rabbit,
      new PaymentQueueTopology(config),
      config,
    );
    await queue.publish({ paymentId: 'p' });
    expect(channel.publish).toHaveBeenCalledWith(
      'ex',
      'route',
      Buffer.from('{"paymentId":"p"}'),
      expect.objectContaining({ persistent: true, messageId: 'p', timeout: 1000 }),
    );
    await expect(queue.publish({ paymentId: 'p' })).rejects.toThrow('not accepted');
    expect(createChannel).toHaveBeenCalledOnce();
    await queue.onModuleDestroy();
    expect(channel.close).toHaveBeenCalledOnce();
  });
});
