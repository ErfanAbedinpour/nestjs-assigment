import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../../../infrastructure/database/prisma/prisma.service';
import { PrismaAdminQuery } from '../prisma-admin-query';

describe('PrismaAdminQuery', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const user = {
    id: 'u',
    email: 'a@example.com',
    name: 'A',
    balance: 9007199254740993n,
    createdAt: now,
    updatedAt: now,
  };
  it('paginates and maps users and transactions without losing precision', async () => {
    const db = {
      user: {
        findMany: vi.fn().mockResolvedValue([user]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(user)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'u' }),
      },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 't',
            userId: 'u',
            type: 'CREDIT',
            amount: 5n,
            balanceAfter: 5n,
            paymentId: null,
            reference: null,
            description: null,
            idempotencyKey: 'k',
            createdAt: now,
          },
        ]),
        count: vi.fn().mockResolvedValue(1),
      },
    };
    const query = new PrismaAdminQuery(db as unknown as PrismaService);
    const page = { page: 2, pageSize: 10 };
    await expect(query.listUsers(page)).resolves.toMatchObject({
      items: [{ balance: '9007199254740993' }],
      total: 1,
    });
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    await expect(query.findUser('u')).resolves.toMatchObject({ id: 'u' });
    await expect(query.listUserTransactions('missing', page)).resolves.toBeUndefined();
    await expect(query.listUserTransactions('u', page)).resolves.toMatchObject({
      items: [{ amount: '5', balanceAfter: '5' }],
    });
  });

  it('maps report totals using integer arithmetic', async () => {
    const db = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([
          { period_start: now, credits: '9007199254740993', debits: 3 },
        ])
        .mockResolvedValueOnce([{ ...user, total_credits: '20', total_debits: 3 }]),
    };
    const query = new PrismaAdminQuery(db as unknown as PrismaService);
    const result = await query.transactionSummary('daily', now, new Date('2026-02-01'));
    expect(result.buckets[0]).toMatchObject({
      credits: '9007199254740993',
      debits: '3',
      net: '9007199254740990',
    });
    await expect(query.balanceUsage()).resolves.toMatchObject({
      items: [{ userId: 'u', totalCredits: '20', totalDebits: '3' }],
    });
  });

  it.each(['monthly', 'yearly'] as const)(
    'uses the correct aggregation period for %s',
    async (period) => {
      const db = { $queryRaw: vi.fn().mockResolvedValue([]) };
      const query = new PrismaAdminQuery(db as unknown as PrismaService);
      await query.transactionSummary(period, now, new Date('2026-02-01'));
      expect(db.$queryRaw.mock.calls[0][1]).toBe(period === 'monthly' ? 'month' : 'year');
    },
  );

  it('returns undefined for an absent user', async () => {
    const db = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    await expect(
      new PrismaAdminQuery(db as unknown as PrismaService).findUser('missing'),
    ).resolves.toBeUndefined();
  });
});
