import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Money } from '../../../../shared/domain/value-object/money.vo';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { Payment } from '../../domain/aggregation/payment.aggregate';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { RetryPolicy } from '../../domain/policy/retry.policy';
import { PaymentQueuePort } from '../ports/payment-queue.port';
import { DispatchPendingPaymentsHandler } from '../handler/dispatch-pending-payments.handler';
import { RecoverStalledPaymentsHandler } from '../handler/recover-stalled-payments.handler';
import { DispatchPendingPaymentsCommand } from '../command/dispatch-pending-payments.command';
import { RecoverStalledPaymentsCommand } from '../command/recover-stalled-payments.command';

const now = new Date('2026-01-01T00:00:00Z');
const makePayment = (id: string) =>
  Payment.submit({
    id,
    userId: 'u',
    amount: Money.positive('10'),
    reference: 'r',
    description: 'd',
    idempotencyKey: id,
    requestFingerprint: id,
    now,
  });
const transaction = { run: async <T>(work: () => Promise<T>) => work() } as UnitOfWork;
const clock = { now: () => now };
const config = { getOrThrow: () => 10 } as unknown as ConfigService;

describe('payment dispatch', () => {
  it('publishes due payments before marking them queued', async () => {
    const payment = makePayment('p');
    const publish = vi.fn();
    const save = vi.fn();
    const repo = { lockDueForDispatch: vi.fn().mockResolvedValue([payment]), save };
    const handler = new DispatchPendingPaymentsHandler(
      repo as unknown as PaymentRepository,
      { publish } as PaymentQueuePort,
      transaction,
      clock,
      config,
    );
    await expect(handler.execute(new DispatchPendingPaymentsCommand())).resolves.toBe(1);
    expect(publish).toHaveBeenCalledWith({ paymentId: 'p' });
    expect(payment.snapshot().status).toBe('QUEUED');
    expect(publish.mock.invocationCallOrder[0]).toBeLessThan(
      save.mock.invocationCallOrder[0]!,
    );
  });

  it('leaves the payment pending when publishing fails', async () => {
    const payment = makePayment('p');
    const save = vi.fn();
    const repo = { lockById: vi.fn().mockResolvedValue(payment), save };
    const handler = new DispatchPendingPaymentsHandler(
      repo as unknown as PaymentRepository,
      { publish: vi.fn().mockRejectedValue(new Error('offline')) } as PaymentQueuePort,
      transaction,
      clock,
      config,
    );
    await expect(
      handler.execute(new DispatchPendingPaymentsCommand('p')),
    ).rejects.toThrow('offline');
    expect(payment.snapshot().status).toBe('PENDING');
    expect(save).not.toHaveBeenCalled();
  });

  it('does not dispatch missing, queued or future payments', async () => {
    const queued = makePayment('queued');
    queued.markQueued(now);
    const future = Payment.rehydrate({
      ...makePayment('future').snapshot(),
      nextDispatchAt: new Date(now.getTime() + 1000),
    });
    const publish = vi.fn();
    const repo = {
      lockById: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(queued)
        .mockResolvedValueOnce(future),
    };
    const handler = new DispatchPendingPaymentsHandler(
      repo as unknown as PaymentRepository,
      { publish } as PaymentQueuePort,
      transaction,
      clock,
      config,
    );
    for (const id of ['missing', 'queued', 'future'])
      await handler.execute(new DispatchPendingPaymentsCommand(id));
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('payment recovery', () => {
  it('recovers queued messages and expired processing attempts', async () => {
    const queued = makePayment('q');
    queued.markQueued(now);
    const processing = makePayment('p');
    processing.markQueued(now);
    processing.claim(now);
    const untouched = makePayment('other');
    const repo = {
      lockStalled: vi.fn().mockResolvedValue([queued, processing, untouched]),
      save: vi.fn(),
    };
    const handler = new RecoverStalledPaymentsHandler(
      repo as unknown as PaymentRepository,
      new RetryPolicy(3, 1000, 10000, 0, { nextUnitInterval: () => 0.5 }),
      transaction,
      clock,
      config,
    );
    await expect(handler.execute(new RecoverStalledPaymentsCommand())).resolves.toBe(2);
    expect(queued.snapshot()).toMatchObject({ status: 'PENDING', attempts: 0 });
    expect(processing.snapshot()).toMatchObject({
      status: 'PENDING',
      attempts: 1,
      failureCode: 'TECHNICAL_FAILURE',
    });
    expect(repo.save).toHaveBeenCalledTimes(2);
  });
});
