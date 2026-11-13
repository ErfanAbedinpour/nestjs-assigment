import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaUnitOfWork } from '../../../../../shared/infrastructure/persistence/prisma-unit-of-work';
import { Money } from '../../../../../shared/domain/value-object/money.vo';
import { User } from '../../../domain/aggregation/user.aggregate';
import { LedgerTransaction } from '../../../domain/entity/ledger-transaction.entity';
import { PrismaUserRepository } from '../prisma-user.repository';
import { PrismaLedgerRepository } from '../prisma-ledger.repository';

describe('user persistence adapters', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const row = {
    id: 'u',
    email: 'a@example.com',
    name: 'A',
    balance: 125n,
    createdAt: now,
    updatedAt: now,
  };
  let client: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    ledgerEntry: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let users: PrismaUserRepository;
  let ledger: PrismaLedgerRepository;
  beforeEach(() => {
    client = {
      user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      ledgerEntry: { findUnique: vi.fn(), create: vi.fn() },
      $queryRaw: vi.fn(),
    };
    const unit = {
      client: () => client,
      requireTransaction: () => client,
    } as unknown as PrismaUnitOfWork;
    users = new PrismaUserRepository(unit);
    ledger = new PrismaLedgerRepository(unit);
  });

  it('maps user lookup results and handles absent rows', async () => {
    client.user.findUnique.mockResolvedValueOnce(row).mockResolvedValueOnce(null);
    expect((await users.findById('u'))?.snapshot().balance.toMinorUnits()).toBe(125n);
    await expect(users.findByEmail('missing@example.com')).resolves.toBeUndefined();
    expect(client.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'missing@example.com' },
    });
  });

  it('locks a row before loading the user', async () => {
    client.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'u' }]);
    client.user.findUnique.mockResolvedValue(row);
    await expect(users.lockById('missing')).resolves.toBeUndefined();
    expect((await users.lockById('u'))?.snapshot().id).toBe('u');
    expect(client.user.findUnique).toHaveBeenCalledOnce();
  });

  it('writes integer balances and translates unique violations', async () => {
    const user = User.rehydrate({ ...row, balance: Money.ofMinorUnits(row.balance) });
    await users.insert(user);
    await users.save(user);
    expect(client.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ balance: 125n }) }),
    );
    expect(client.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ balance: 125n }) }),
    );
    client.user.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(users.insert(user)).rejects.toHaveProperty(
      'name',
      'UniqueConstraintError',
    );
    const error = new Error('offline');
    client.user.create.mockRejectedValueOnce(error);
    await expect(users.insert(user)).rejects.toBe(error);
  });

  it('maps ledger entries and persists their amounts', async () => {
    const entry = LedgerTransaction.credit({
      id: 't',
      userId: 'u',
      amount: Money.positive('125'),
      balanceAfter: Money.positive('125'),
      reference: null,
      description: null,
      idempotencyKey: 'key',
      createdAt: now,
    });
    const snapshot = entry.snapshot();
    client.ledgerEntry.findUnique
      .mockResolvedValueOnce({ ...snapshot, amount: 125n, balanceAfter: 125n })
      .mockResolvedValueOnce(null);
    expect(
      (await ledger.findByIdempotencyKey('u', 'key'))?.matchesCredit(
        Money.positive('125'),
      ),
    ).toBe(true);
    await expect(ledger.findByIdempotencyKey('u', 'missing')).resolves.toBeUndefined();
    await ledger.append(entry);
    expect(client.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ amount: 125n, balanceAfter: 125n }),
    });
    client.ledgerEntry.create.mockRejectedValueOnce({ code: 'P2002' });
    await expect(ledger.append(entry)).rejects.toHaveProperty(
      'name',
      'UniqueConstraintError',
    );
  });
});
