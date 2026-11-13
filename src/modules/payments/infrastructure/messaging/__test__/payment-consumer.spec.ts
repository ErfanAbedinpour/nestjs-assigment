import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { RabbitMqService } from '../../../../../infrastructure/messaging/rabbitmq/rabbitmq.service';
import { PaymentQueueTopology } from '../payment-queue.topology';
import { PaymentConsumer } from '../payment.consumer';
import { ProcessPaymentCommand } from '../../../application/command/process-payment.command';

describe('PaymentConsumer', () => {
  it('acknowledges successful deliveries and discards malformed messages', async () => {
    const channel = {
      on: vi.fn(),
      consume: vi.fn(),
      ack: vi.fn(),
      nack: vi.fn(),
      cancelAll: vi.fn(),
      close: vi.fn(),
    };
    const rabbit = {
      getConnection: () => ({ createChannel: () => channel }),
    } as unknown as RabbitMqService;
    const topology = {
      names: () => ({ queue: 'q', prefetch: 2 }),
      assert: vi.fn(),
    } as unknown as PaymentQueueTopology;
    const execute = vi.fn().mockResolvedValue(undefined);
    const consumer = new PaymentConsumer(
      rabbit,
      topology,
      { execute } as unknown as CommandBus,
      {} as ConfigService,
    );
    await consumer.onApplicationBootstrap();
    const callback = channel.consume.mock.calls[0][1] as (message: unknown) => void;
    const valid = { content: Buffer.from('{"paymentId":"p"}') };
    callback(valid);
    await vi.waitFor(() => expect(channel.ack).toHaveBeenCalledWith(valid));
    expect(execute).toHaveBeenCalledWith(expect.any(ProcessPaymentCommand));
    const malformed = { content: Buffer.from('invalid') };
    callback(malformed);
    expect(channel.nack).toHaveBeenCalledWith(malformed, false, false);
    await consumer.onModuleDestroy();
    expect(channel.cancelAll).toHaveBeenCalledOnce();
    expect(channel.close).toHaveBeenCalledOnce();
  });

  it('requeues a delivery when processing fails', async () => {
    const channel = {
      on: vi.fn(),
      consume: vi.fn(),
      ack: vi.fn(),
      nack: vi.fn(),
      cancelAll: vi.fn(),
      close: vi.fn(),
    };
    const rabbit = {
      getConnection: () => ({ createChannel: () => channel }),
    } as unknown as RabbitMqService;
    const topology = {
      names: () => ({ queue: 'q', prefetch: 1 }),
    } as unknown as PaymentQueueTopology;
    const consumer = new PaymentConsumer(
      rabbit,
      topology,
      {
        execute: vi.fn().mockRejectedValue(new Error('offline')),
      } as unknown as CommandBus,
      { getOrThrow: () => 0 } as unknown as ConfigService,
    );
    await consumer.onApplicationBootstrap();
    const callback = channel.consume.mock.calls[0][1] as (message: unknown) => void;
    const message = { content: Buffer.from('{"paymentId":"p"}') };
    callback(message);
    await vi.waitFor(() =>
      expect(channel.nack).toHaveBeenCalledWith(message, false, true),
    );
    expect(channel.ack).not.toHaveBeenCalled();
    await consumer.onModuleDestroy();
  });
});
