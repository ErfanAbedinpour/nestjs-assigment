import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Money } from '../../../../../shared/domain/value-object/money.vo';
import { PrismaUnitOfWork } from '../../../../../shared/infrastructure/persistence/prisma-unit-of-work';
import { Payment } from '../../../domain/aggregation/payment.aggregate';
import { PrismaPaymentRepository } from '../prisma-payment.repository';

describe('PrismaPaymentRepository', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const makePayment = () =>
    Payment.submit({
      id: 'p',
      userId: 'u',
      amount: Money.positive('100'),
      reference: 'r',
      description: 'd',
      idempotencyKey: 'k',
      requestFingerprint: 'f',
      now,
    });
  const row = () => ({ ...makePayment().snapshot(), amount: 100n });
  let db: {
    payment: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    paymentEvent: {
      createMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    $queryRaw: ReturnType<typeof vi.fn>;
  };
  let repository: PrismaPaymentRepository;
  beforeEach(() => {
    db = {
      payment: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      paymentEvent: { createMany: vi.fn(), findMany: vi.fn() },
      $queryRaw: vi.fn(),
    };
    repository = new PrismaPaymentRepository(
      { client: () => db, requireTransaction: () => db } as unknown as PrismaUnitOfWork,
      { next: () => 'event' },
    );
  });

  it('maps lookups and returns undefined for missing records', async () => {
    db.payment.findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce(null);
    expect((await repository.findById('p'))?.snapshot().amount.toString()).toBe('100');
    await expect(repository.findByIdempotencyKey('u', 'k')).resolves.toBeUndefined();
    expect(db.payment.findUnique).toHaveBeenCalledWith({
      where: { userId_idempotencyKey: { userId: 'u', idempotencyKey: 'k' } },
    });
  });

  it('inserts the payment and its creation event', async () => {
    const payment = makePayment();
    await repository.insert(payment);
    expect(db.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'p', amount: 100n, status: 'PENDING' }),
    });
    expect(db.paymentEvent.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ paymentId: 'p', type: 'CREATED', id: 'event' })],
    });
    expect(payment.pullDomainEvents()).toEqual([]);
  });

  it('translates unique conflicts and preserves unexpected failures', async () => {
    db.payment.create
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockRejectedValueOnce(new Error('offline'));
    await expect(repository.insert(makePayment())).rejects.toHaveProperty(
      'name',
      'UniqueConstraintError',
    );
    await expect(repository.insert(makePayment())).rejects.toThrow('offline');
  });

  it('updates with optimistic concurrency and records events', async () => {
    const payment = makePayment();
    db.payment.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await repository.save(payment);
    expect(payment.snapshot().version).toBe(1);
    expect(db.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p', version: 0 } }),
    );
    await expect(repository.save(payment)).rejects.toThrow('changed concurrently');
  });

  it('loads only locked rows and preserves their lock order', async () => {
    db.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'p' }])
      .mockResolvedValueOnce([{ id: 'missing' }, { id: 'p' }])
      .mockResolvedValueOnce([]);
    db.payment.findUnique.mockResolvedValue(row());
    db.payment.findMany.mockResolvedValue([row()]);
    await expect(repository.lockById('missing')).resolves.toBeUndefined();
    expect((await repository.lockById('p'))?.snapshot().id).toBe('p');
    expect((await repository.lockDueForDispatch(5)).map((p) => p.snapshot().id)).toEqual([
      'p',
    ]);
    await expect(
      repository.lockStalled({ leaseMs: 1, queuedStaleMs: 2, limit: 5 }),
    ).resolves.toEqual([]);
  });

  it('maps event metadata and discards nested values', async () => {
    db.paymentEvent.findMany.mockResolvedValue([
      {
        id: 'e',
        paymentId: 'p',
        type: 'FAILED',
        attempt: 1,
        fromStatus: 'PROCESSING',
        toStatus: 'FAILED',
        metadata: { reason: 'down', count: 2, nested: { secret: true } },
        occurredAt: now,
      },
    ]);
    await expect(repository.listEvents('p')).resolves.toEqual([
      expect.objectContaining({ metadata: { reason: 'down', count: 2 } }),
    ]);
  });

  it('handles empty metadata and saves without new events', async () => {
    const payment = makePayment();
    payment.pullDomainEvents();
    db.payment.updateMany.mockResolvedValue({ count: 1 });
    await repository.save(payment);
    expect(db.paymentEvent.createMany).not.toHaveBeenCalled();
    db.paymentEvent.findMany.mockResolvedValue([
      {
        id: 'e',
        paymentId: 'p',
        type: 'CREATED',
        attempt: 0,
        fromStatus: null,
        toStatus: 'PENDING',
        metadata: null,
        occurredAt: now,
      },
    ]);
    await expect(repository.listEvents('p')).resolves.toEqual([
      expect.objectContaining({ metadata: null }),
    ]);
  });

  it('returns missing lookups and maps a found idempotency record', async () => {
    db.payment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(row())
      .mockResolvedValueOnce(null);
    await expect(repository.findById('missing')).resolves.toBeUndefined();
    expect((await repository.findByIdempotencyKey('u', 'k'))?.snapshot().id).toBe('p');
    db.$queryRaw.mockResolvedValue([{ id: 'p' }]);
    await expect(repository.lockById('p')).resolves.toBeUndefined();
  });

  it('persists non-null retry event metadata', async () => {
    const payment = makePayment();
    payment.markQueued(now);
    payment.claim(now);
    payment.failTechnical({
      now,
      code: 'NETWORK',
      reason: 'offline',
      decision: { retry: true, delayMs: 1000 },
      source: 'worker',
    });
    db.payment.updateMany.mockResolvedValue({ count: 1 });
    await repository.save(payment);
    expect(db.paymentEvent.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: 'RETRY_TRIGGERED',
          metadata: expect.objectContaining({ source: 'worker', delayMs: 1000 }),
        }),
      ]),
    });
  });

  it.each([[], 'invalid', 42])(
    'treats non-object event metadata as null',
    async (metadata) => {
      db.paymentEvent.findMany.mockResolvedValue([
        {
          id: 'e',
          paymentId: 'p',
          type: 'CREATED',
          attempt: 0,
          fromStatus: null,
          toStatus: 'PENDING',
          metadata,
          occurredAt: now,
        },
      ]);
      await expect(repository.listEvents('p')).resolves.toEqual([
        expect.objectContaining({ metadata: null }),
      ]);
    },
  );
});
