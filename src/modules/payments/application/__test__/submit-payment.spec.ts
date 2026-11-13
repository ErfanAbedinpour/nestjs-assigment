import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { Money } from '../../../../shared/domain/value-object/money.vo';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { CachePort } from '../../../../shared/application/ports/cache-port';
import { UniqueConstraintError } from '../../../../shared/application/unique-constraint.error';
import { Payment } from '../../domain/aggregation/payment.aggregate';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { AccountLookupPort } from '../ports/account-ports';
import { SubmitPaymentHandler } from '../handler/submit-payment.handler';
import { SubmitPaymentCommand } from '../command/submit-payment.command';
import { paymentFingerprint } from '../payment-fingerprint';

describe('SubmitPaymentHandler', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const input = {
    userId: 'u1',
    amount: Money.positive('100'),
    reference: 'ref',
    description: 'purchase',
    idempotencyKey: 'key',
  };
  let payments: {
    insert: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByIdempotencyKey: ReturnType<typeof vi.fn>;
  };
  let accounts: { exists: ReturnType<typeof vi.fn> };
  let cache: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let dispatch: ReturnType<typeof vi.fn>;
  let handler: SubmitPaymentHandler;
  const existing = (fingerprint = paymentFingerprint({ ...input, amount: '100' })) =>
    Payment.submit({ id: 'existing', ...input, requestFingerprint: fingerprint, now });

  beforeEach(() => {
    payments = { insert: vi.fn(), findById: vi.fn(), findByIdempotencyKey: vi.fn() };
    accounts = { exists: vi.fn().mockResolvedValue(true) };
    cache = { get: vi.fn(), set: vi.fn() };
    dispatch = vi.fn();
    handler = new SubmitPaymentHandler(
      payments as unknown as PaymentRepository,
      accounts as unknown as AccountLookupPort,
      { run: async (work) => work() } as UnitOfWork,
      { next: () => 'p1' },
      { now: () => now },
      cache as unknown as CachePort,
      { execute: dispatch } as unknown as CommandBus,
      { getOrThrow: () => 1000 } as unknown as ConfigService,
    );
  });

  it('persists, caches and dispatches a new payment', async () => {
    await expect(handler.execute(new SubmitPaymentCommand(input))).resolves.toMatchObject(
      { id: 'p1', status: 'PENDING' },
    );
    expect(payments.insert).toHaveBeenCalledOnce();
    expect(cache.set).toHaveBeenCalledWith(
      'idempotency:payment:u1:key',
      { paymentId: 'p1' },
      1000,
    );
    expect(dispatch).toHaveBeenCalledOnce();
  });

  it('keeps a committed payment when dispatch fails', async () => {
    dispatch.mockRejectedValue(new Error('broker down'));
    await expect(handler.execute(new SubmitPaymentCommand(input))).resolves.toMatchObject(
      { id: 'p1', status: 'PENDING' },
    );
    expect(payments.insert).toHaveBeenCalledOnce();
  });

  it('rejects unknown users before insertion', async () => {
    accounts.exists.mockResolvedValue(false);
    await expect(handler.execute(new SubmitPaymentCommand(input))).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
    expect(payments.insert).not.toHaveBeenCalled();
  });

  it('replays a cached payment without creating another', async () => {
    cache.get.mockResolvedValue({ paymentId: 'existing' });
    payments.findById.mockResolvedValue(existing());
    await expect(handler.execute(new SubmitPaymentCommand(input))).resolves.toMatchObject(
      { id: 'existing' },
    );
    expect(payments.insert).not.toHaveBeenCalled();
  });

  it('rejects an idempotency key reused with different details', async () => {
    cache.get.mockResolvedValue({ paymentId: 'existing' });
    payments.findById.mockResolvedValue(existing('different'));
    await expect(handler.execute(new SubmitPaymentCommand(input))).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('replays a concurrent insert after a uniqueness conflict', async () => {
    payments.insert.mockRejectedValue(new UniqueConstraintError());
    payments.findByIdempotencyKey.mockResolvedValue(existing());
    await expect(handler.execute(new SubmitPaymentCommand(input))).resolves.toMatchObject(
      { id: 'existing' },
    );
    expect(payments.findByIdempotencyKey).toHaveBeenCalledWith('u1', 'key');
  });

  it('returns a queued replay without dispatching again', async () => {
    const payment = existing();
    payment.markQueued(now);
    cache.get.mockResolvedValue({ paymentId: 'existing' });
    payments.findById.mockResolvedValue(payment);
    await expect(handler.execute(new SubmitPaymentCommand(input))).resolves.toMatchObject(
      { status: 'QUEUED' },
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('propagates insert failures and unresolved uniqueness conflicts', async () => {
    const error = new Error('offline');
    payments.insert
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(new UniqueConstraintError());
    await expect(handler.execute(new SubmitPaymentCommand(input))).rejects.toBe(error);
    await expect(handler.execute(new SubmitPaymentCommand(input))).rejects.toBeInstanceOf(
      UniqueConstraintError,
    );
  });

  it('creates a new payment when the cached payment no longer exists', async () => {
    cache.get.mockResolvedValue({ paymentId: 'missing' });
    payments.findById.mockResolvedValue(undefined);
    await expect(handler.execute(new SubmitPaymentCommand(input))).resolves.toMatchObject(
      { id: 'p1' },
    );
    expect(payments.insert).toHaveBeenCalledOnce();
  });

  it('handles dispatch errors that are not Error objects', async () => {
    dispatch.mockRejectedValue('offline');
    await expect(handler.execute(new SubmitPaymentCommand(input))).resolves.toMatchObject(
      { id: 'p1', status: 'PENDING' },
    );
  });
});
