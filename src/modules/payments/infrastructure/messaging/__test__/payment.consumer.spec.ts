import { describe, expect, it, vi } from 'vitest';
import { PaymentConsumer } from '../payment.consumer';

describe('PaymentConsumer shutdown', () => {
  it('stops deliveries and waits for the pending outcome', async () => {
    let finish!: () => void;
    const processing = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const channel = { cancel: vi.fn(), ack: vi.fn() };
    const message = { fields: { consumerTag: 'worker' } };
    const consumer = new PaymentConsumer(
      { execute: () => processing } as never,
      {} as never,
    );
    const handling = consumer.processPayment(
      { paymentId: 'p' },
      { getChannelRef: () => channel, getMessage: () => message },
    );
    const shutdown = consumer.onModuleDestroy();
    expect(channel.cancel).toHaveBeenCalledWith('worker');
    expect(channel.ack).not.toHaveBeenCalled();
    finish();
    await Promise.all([handling, shutdown]);
    expect(channel.ack).toHaveBeenCalledWith(message);
  });
});
