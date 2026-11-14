import { describe, expect, it, vi } from 'vitest';
import { PaymentConsumer } from '../payment.consumer';

describe('PaymentConsumer shutdown', () => {
  it('cancels deliveries and waits for processing before closing the channel', async () => {
    let finish!: () => void;
    const processing = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let deliver!: (message: unknown) => void;
    const channel = {
      on: vi.fn(),
      consume: vi.fn(async (_queue, callback) => {
        deliver = callback;
      }),
      cancelAll: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      ack: vi.fn(),
    };
    const consumer = new PaymentConsumer(
      { getConnection: () => ({ createChannel: () => channel }) } as never,
      { names: () => ({ queue: 'payments', prefetch: 1 }) } as never,
      { execute: () => processing } as never,
      {} as never,
    );
    await consumer.onApplicationBootstrap();
    deliver({ content: Buffer.from(JSON.stringify({ paymentId: 'p1' })) });
    const shutdown = consumer.onModuleDestroy();
    await Promise.resolve();
    expect(channel.cancelAll).toHaveBeenCalledOnce();
    expect(channel.close).not.toHaveBeenCalled();
    finish();
    await shutdown;
    expect(channel.ack).toHaveBeenCalledOnce();
    expect(channel.close).toHaveBeenCalledOnce();
  });
});
