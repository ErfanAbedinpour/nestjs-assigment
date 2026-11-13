import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Money } from '../../../../shared/domain/value-object/money.vo';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { Payment } from '../../domain/aggregation/payment.aggregate';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { FailureCode, PaymentStatus } from '../../domain/types/payment-status.types';
import { RetryPolicy } from '../../domain/policy/retry.policy';
import { ProcessPaymentCommand } from '../command/process-payment.command';
import { ProcessPaymentHandler } from '../handler/process-payment.handler';
import { AccountDebitPort, AccountLookupPort } from '../ports/account-ports';
import { PaymentFailureSimulator } from '../ports/failure-simulator.port';

describe('ProcessPaymentHandler', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  let payment: Payment;
  let repository: { lockById: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let debit: ReturnType<typeof vi.fn>;
  let balanceCovers: ReturnType<typeof vi.fn>;
  let evaluate: ReturnType<typeof vi.fn>;
  let handler: ProcessPaymentHandler;

  beforeEach(() => {
    payment = Payment.submit({
      id: 'p1',
      userId: 'u1',
      amount: Money.positive('100'),
      reference: 'ref',
      description: 'payment',
      idempotencyKey: 'key',
      requestFingerprint: 'hash',
      now,
    });
    payment.markQueued(now);
    payment.pullDomainEvents();
    repository = {
      lockById: vi.fn().mockImplementation(async () => payment),
      save: vi.fn(),
    };
    debit = vi.fn();
    balanceCovers = vi.fn().mockResolvedValue(true);
    evaluate = vi.fn().mockReturnValue({ kind: 'none' });
    handler = new ProcessPaymentHandler(
      repository as unknown as PaymentRepository,
      { debit } as AccountDebitPort,
      { balanceCovers, exists: vi.fn() } as AccountLookupPort,
      { evaluate } as PaymentFailureSimulator,
      new RetryPolicy(3, 1000, 10000, 0, { nextUnitInterval: () => 0.5 }),
      { run: async (work) => work() } as UnitOfWork,
      { now: () => now },
    );
  });

  it('settles a successful payment once and ignores duplicate deliveries', async () => {
    await handler.execute(new ProcessPaymentCommand('p1'));
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(payment.snapshot()).toMatchObject({
      status: PaymentStatus.Succeeded,
      attempts: 1,
    });
    expect(debit).toHaveBeenCalledOnce();
    expect(debit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        paymentId: 'p1',
        idempotencyKey: 'payment:p1',
      }),
    );
  });

  it('fails insufficient balance on the first attempt without invoking the simulator', async () => {
    balanceCovers.mockResolvedValue(false);
    debit.mockRejectedValue(
      new DomainError('INSUFFICIENT_BALANCE', 'Insufficient balance'),
    );
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(payment.snapshot()).toMatchObject({
      status: PaymentStatus.Failed,
      attempts: 1,
      failureCode: 'INSUFFICIENT_BALANCE',
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(payment.pullDomainEvents().map((event) => event.type)).toEqual([
      'PROCESSING_STARTED',
      'FAILED',
    ]);
  });

  it('schedules a simulated technical failure without debiting', async () => {
    evaluate.mockReturnValue({
      kind: 'technical',
      code: FailureCode.Simulated,
      reason: 'gateway down',
    });
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(payment.snapshot()).toMatchObject({
      status: PaymentStatus.Pending,
      attempts: 1,
      failureCode: FailureCode.Simulated,
      nextDispatchAt: new Date(now.getTime() + 1000),
    });
    expect(debit).not.toHaveBeenCalled();
  });

  it('does not debit an attempt whose processing lease was lost', async () => {
    repository.lockById.mockResolvedValueOnce(payment).mockResolvedValueOnce(undefined);
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(debit).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledOnce();
  });

  it('does nothing for a missing payment', async () => {
    repository.lockById.mockResolvedValue(undefined);
    await handler.execute(new ProcessPaymentCommand('missing'));
    expect(balanceCovers).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('retries unexpected simulator errors as technical failures', async () => {
    evaluate.mockImplementation(() => {
      throw new Error('simulator unavailable');
    });
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(payment.snapshot()).toMatchObject({
      status: PaymentStatus.Pending,
      failureCode: FailureCode.Technical,
      failureReason: 'simulator unavailable',
    });
    expect(debit).not.toHaveBeenCalled();
  });

  it('retries unexpected debit errors and preserves the failure reason', async () => {
    debit.mockRejectedValue(new Error('database unavailable'));
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(payment.snapshot()).toMatchObject({
      status: PaymentStatus.Pending,
      failureCode: FailureCode.Technical,
      failureReason: 'database unavailable',
    });
  });

  it('ignores a technical failure after the processing lease is lost', async () => {
    evaluate.mockReturnValue({
      kind: 'technical',
      code: FailureCode.Simulated,
      reason: 'offline',
    });
    repository.lockById.mockResolvedValueOnce(payment).mockResolvedValueOnce(undefined);
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(repository.save).toHaveBeenCalledOnce();
  });

  it('uses a safe reason for non-Error simulator failures', async () => {
    evaluate.mockImplementation(() => {
      throw 'offline';
    });
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(payment.snapshot()).toMatchObject({
      status: PaymentStatus.Pending,
      failureReason: 'Technical payment failure',
    });
  });

  it('ignores a failure when the payment is no longer the claimed attempt', async () => {
    evaluate.mockImplementation(() => {
      payment.failTechnical({
        now,
        code: 'LOST',
        reason: 'lease expired',
        decision: { retry: true, delayMs: 0 },
        source: 'reconciler',
      });
      return { kind: 'technical', code: 'NETWORK', reason: 'offline' };
    });
    await handler.execute(new ProcessPaymentCommand('p1'));
    expect(payment.snapshot()).toMatchObject({
      status: PaymentStatus.Pending,
      failureCode: 'LOST',
    });
    expect(repository.save).toHaveBeenCalledOnce();
  });
});
