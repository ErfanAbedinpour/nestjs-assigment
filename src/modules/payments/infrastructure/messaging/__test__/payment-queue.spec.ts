import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { RabbitPaymentQueue } from '../rabbit-payment-queue';
import { PAYMENT_PROCESS_PATTERN } from '../payment-rmq.options';

describe('payment queue', () => {
  it('awaits publication and propagates broker errors', async () => {
    const emit = vi
      .fn()
      .mockReturnValueOnce(of(undefined))
      .mockReturnValueOnce(throwError(() => new Error('refused')));
    const queue = new RabbitPaymentQueue(
      { emit, close: vi.fn() } as never,
      { getOrThrow: () => 1000 } as never,
    );
    await queue.publish({ paymentId: 'p' });
    expect(emit).toHaveBeenCalledWith(
      PAYMENT_PROCESS_PATTERN,
      expect.objectContaining({
        data: { paymentId: 'p' },
        options: expect.objectContaining({ persistent: true, messageId: 'p' }),
      }),
    );
    await expect(queue.publish({ paymentId: 'p' })).rejects.toThrow('refused');
  });
});
