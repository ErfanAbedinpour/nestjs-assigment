import { describe, expect, it } from 'vitest';
import { Money } from '../../../../../shared/domain/value-object/money.vo';
import { Payment, canRetryManually } from '../payment.aggregate';
import { FailureCode, PaymentStatus } from '../../types/payment-status.types';
import { RetryPolicy } from '../../policy/retry.policy';

const now = new Date('2026-01-01T00:00:00Z');
const create = () =>
  Payment.submit({
    id: 'p1',
    userId: 'u1',
    amount: Money.positive('10'),
    reference: 'ref',
    description: 'payment',
    idempotencyKey: 'key',
    requestFingerprint: 'hash',
    now,
  });

describe('Payment lifecycle', () => {
  it('claims and settles exactly the current attempt', () => {
    const payment = create();
    expect(() => payment.claim(now)).toThrow();
    payment.markQueued(now);
    expect(payment.claim(now)).toBe(1);
    expect(payment.isProcessingAttempt(1)).toBe(true);
    expect(payment.isProcessingAttempt(2)).toBe(false);
    payment.succeed(now);
    expect(payment.snapshot().status).toBe(PaymentStatus.Succeeded);
    expect(() => payment.cancel(now)).toThrow();
    expect(payment.pullDomainEvents().map((event) => event.type)).toEqual([
      'CREATED',
      'QUEUED',
      'PROCESSING_STARTED',
      'SUCCEEDED',
    ]);
    expect(payment.pullDomainEvents()).toEqual([]);
  });

  it('schedules technical retries and resets a failed payment for manual retry', () => {
    const payment = create();
    payment.markQueued(now);
    payment.claim(now);
    payment.failTechnical({
      now,
      code: 'network',
      reason: 'down',
      source: 'worker',
      decision: { retry: true, delayMs: 1000 },
    });
    expect(payment.snapshot().nextDispatchAt.getTime()).toBe(now.getTime() + 1000);
    payment.markQueued(now);
    payment.claim(now);
    payment.failTechnical({
      now,
      code: 'network',
      reason: 'down',
      source: 'worker',
      decision: { retry: false, delayMs: 0 },
    });
    expect(payment.snapshot().status).toBe(PaymentStatus.Failed);
    payment.retryManually(now);
    expect(payment.snapshot()).toMatchObject({
      status: PaymentStatus.Pending,
      attempts: 0,
      failureCode: null,
    });
  });

  it('recovers lost messages, records business failures and cancels pending payments', () => {
    const payment = create();
    payment.markQueued(now);
    payment.requeueLostMessage(now);
    payment.markQueued(now);
    payment.claim(now);
    payment.failBusiness('declined', 'declined', now);
    expect(payment.snapshot().failureCode).toBe('declined');
    payment.retryManually(now);
    payment.cancel(now);
    expect(Payment.rehydrate(payment.snapshot()).snapshot().status).toBe(
      PaymentStatus.Cancelled,
    );
    payment.confirmPersistedVersion();
    expect(payment.snapshot().version).toBe(1);
  });

  it('only permits eligible manual retries', () => {
    expect(canRetryManually(FailureCode.Technical, false)).toBe(true);
    expect(canRetryManually(FailureCode.Simulated, false)).toBe(true);
    expect(canRetryManually(FailureCode.InsufficientBalance, false)).toBe(false);
    expect(canRetryManually(FailureCode.InsufficientBalance, true)).toBe(true);
    expect(canRetryManually(null, true)).toBe(false);
  });
});

describe('RetryPolicy', () => {
  it('caps exponential delay and stops at the attempt limit', () => {
    const policy = new RetryPolicy(5, 100, 250, 0.2, { nextUnitInterval: () => 0.5 });
    expect(policy.decide(1)).toEqual({ retry: true, delayMs: 100 });
    expect(policy.decide(4)).toEqual({ retry: true, delayMs: 250 });
    expect(policy.decide(5)).toEqual({ retry: false, delayMs: 0 });
  });
});
