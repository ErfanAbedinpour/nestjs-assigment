import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Money } from '../../../../shared/domain/value-object/money.vo';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { UniqueConstraintError } from '../../../../shared/application/unique-constraint.error';
import { User } from '../../domain/aggregation/user.aggregate';
import { LedgerTransaction } from '../../domain/entity/ledger-transaction.entity';
import { UserRepository } from '../../domain/repository/user.repository';
import { LedgerRepository } from '../../domain/repository/ledger.repository';
import { CreditUserCommand } from '../command/credit-user.command';
import { CreditUserHandler } from '../handler/credit-user.handler';

describe('CreditUserHandler', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const input = { userId: 'u1', amount: Money.positive('100'), idempotencyKey: 'key' };
  let users: { lockById: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let ledger: {
    findByIdempotencyKey: ReturnType<typeof vi.fn>;
    append: ReturnType<typeof vi.fn>;
  };
  let handler: CreditUserHandler;
  const entry = (amount: string) =>
    LedgerTransaction.credit({
      id: 't1',
      userId: 'u1',
      amount: Money.positive(amount),
      balanceAfter: Money.positive(amount),
      reference: null,
      description: null,
      idempotencyKey: 'key',
      createdAt: now,
    });

  beforeEach(() => {
    users = {
      lockById: vi
        .fn()
        .mockResolvedValue(
          User.register({ id: 'u1', email: 'a@example.com', name: 'A', now }),
        ),
      save: vi.fn(),
    };
    ledger = { findByIdempotencyKey: vi.fn(), append: vi.fn() };
    handler = new CreditUserHandler(
      users as unknown as UserRepository,
      ledger as unknown as LedgerRepository,
      { run: async (work) => work() } as UnitOfWork,
      { next: () => 't1' },
      { now: () => now },
    );
  });

  it('credits the account and records a ledger entry', async () => {
    await expect(handler.execute(new CreditUserCommand(input))).resolves.toMatchObject({
      transactionId: 't1',
      amount: '100',
      balanceAfter: '100',
      replayed: false,
    });
    expect(users.save).toHaveBeenCalledOnce();
    expect(ledger.append).toHaveBeenCalledOnce();
  });

  it('replays an existing credit without writing again', async () => {
    ledger.findByIdempotencyKey.mockResolvedValue(entry('100'));
    await expect(handler.execute(new CreditUserCommand(input))).resolves.toMatchObject({
      transactionId: 't1',
      replayed: true,
    });
    expect(users.lockById).not.toHaveBeenCalled();
    expect(ledger.append).not.toHaveBeenCalled();
  });

  it('rejects reuse of a key with a different amount', async () => {
    ledger.findByIdempotencyKey.mockResolvedValue(entry('50'));
    await expect(handler.execute(new CreditUserCommand(input))).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED',
    });
    expect(ledger.append).not.toHaveBeenCalled();
  });

  it('replays a credit committed while waiting for the user lock', async () => {
    ledger.findByIdempotencyKey
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(entry('100'));
    await expect(handler.execute(new CreditUserCommand(input))).resolves.toMatchObject({
      replayed: true,
    });
    expect(users.save).not.toHaveBeenCalled();
  });

  it('reports a missing user without writing', async () => {
    users.lockById.mockResolvedValue(undefined);
    await expect(handler.execute(new CreditUserCommand(input))).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
    expect(ledger.append).not.toHaveBeenCalled();
  });

  it('replays the winning credit after a uniqueness conflict', async () => {
    ledger.findByIdempotencyKey
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(entry('100'));
    ledger.append.mockRejectedValue(new UniqueConstraintError());
    await expect(handler.execute(new CreditUserCommand(input))).resolves.toMatchObject({
      replayed: true,
    });
  });

  it('propagates uniqueness conflicts when no winning entry exists', async () => {
    const error = new UniqueConstraintError();
    ledger.append.mockRejectedValue(error);
    await expect(handler.execute(new CreditUserCommand(input))).rejects.toBe(error);
  });
});
