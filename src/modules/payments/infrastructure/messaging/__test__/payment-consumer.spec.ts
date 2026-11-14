import { describe, expect, it, vi } from 'vitest';
import { PaymentConsumer } from '../payment.consumer';
import {
  PaymentMessageDeserializer,
  PAYMENT_PROCESS_PATTERN,
} from '../payment-rmq.options';

describe('PaymentConsumer', () => {
  it('accepts deliveries from the previous publisher', () => {
    expect(new PaymentMessageDeserializer().deserialize({ paymentId: 'p' })).toEqual({
      pattern: PAYMENT_PROCESS_PATTERN,
      data: { paymentId: 'p' },
    });
  });
  it('acks durable outcomes, dead letters malformed data, and requeues failures', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('offline'));
    const channel = { ack: vi.fn(), nack: vi.fn(), cancel: vi.fn() };
    const message = { fields: { consumerTag: 'worker' } };
    const context = { getChannelRef: () => channel, getMessage: () => message };
    const consumer = new PaymentConsumer(
      { execute } as never,
      { getOrThrow: () => 0 } as never,
    );
    await consumer.processPayment({ paymentId: 'p' }, context);
    expect(channel.ack).toHaveBeenCalledWith(message);
    await consumer.processPayment(null, context);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    await consumer.processPayment({ paymentId: 'p' }, context);
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});
