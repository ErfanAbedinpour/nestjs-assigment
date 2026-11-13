import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { PrismaUnitOfWork } from '../prisma-unit-of-work';

describe('PrismaUnitOfWork', () => {
  it('shares the transaction with nested operations and restores context afterwards', async () => {
    const tx = { name: 'transaction' };
    const prisma = { $transaction: vi.fn(async (callback) => callback(tx)) };
    const unit = new PrismaUnitOfWork(prisma as unknown as PrismaService);
    expect(unit.client()).toBe(prisma);
    expect(() => unit.requireTransaction()).toThrow('inside a unit of work');
    await unit.run(async () => {
      expect(unit.requireTransaction()).toBe(tx);
      await unit.run(async () => expect(unit.client()).toBe(tx));
    });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(unit.client()).toBe(prisma);
  });

  it('propagates errors and clears the transaction context', async () => {
    const error = new Error('rollback');
    const prisma = { $transaction: vi.fn(async (callback) => callback({})) };
    const unit = new PrismaUnitOfWork(prisma as unknown as PrismaService);
    await expect(
      unit.run(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(() => unit.requireTransaction()).toThrow();
  });
});
