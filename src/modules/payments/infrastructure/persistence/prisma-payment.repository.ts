import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../../infrastructure/database/prisma/generated/client';
import { Money } from '../../../../shared/domain/money';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { UniqueConstraintError } from '../../../../shared/application/unique-constraint.error';
import { isUniqueConstraintError } from '../../../../shared/infrastructure/persistence/prisma-errors';
import { PrismaUnitOfWork } from '../../../../shared/infrastructure/persistence/prisma-unit-of-work';
import { Payment } from '../../domain/payment';
import {
  PaymentRepository,
  type StalledPaymentCriteria,
} from '../../domain/payment.repository';
import {
  type EventMetadata,
  type PaymentDomainEvent,
  type PaymentEventType,
  type PaymentStatus,
  type StoredPaymentEvent,
} from '../../domain/payment-status';

type PaymentRow = {
  id: string;
  userId: string;
  amount: bigint;
  reference: string;
  description: string;
  status: PaymentStatus;
  idempotencyKey: string;
  requestFingerprint: string;
  attempts: number;
  failureCode: string | null;
  failureReason: string | null;
  nextDispatchAt: Date;
  queuedAt: Date | null;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type EventRow = {
  id: string;
  paymentId: string;
  type: PaymentEventType;
  attempt: number;
  fromStatus: PaymentStatus | null;
  toStatus: PaymentStatus;
  metadata: Prisma.JsonValue | null;
  occurredAt: Date;
};

@Injectable()
export class PrismaPaymentRepository extends PaymentRepository {
  constructor(
    private readonly unitOfWork: PrismaUnitOfWork,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  override async findById(id: string): Promise<Payment | undefined> {
    const row = await this.unitOfWork.client().payment.findUnique({ where: { id } });
    return row ? toPayment(row) : undefined;
  }

  override async findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<Payment | undefined> {
    const row = await this.unitOfWork.client().payment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    return row ? toPayment(row) : undefined;
  }

  override async insert(payment: Payment): Promise<void> {
    const snapshot = payment.snapshot();
    const client = this.unitOfWork.client();
    try {
      await client.payment.create({
        data: {
          id: snapshot.id,
          userId: snapshot.userId,
          amount: snapshot.amount.toMinorUnits(),
          reference: snapshot.reference,
          description: snapshot.description,
          status: snapshot.status,
          idempotencyKey: snapshot.idempotencyKey,
          requestFingerprint: snapshot.requestFingerprint,
          attempts: snapshot.attempts,
          failureCode: snapshot.failureCode,
          failureReason: snapshot.failureReason,
          nextDispatchAt: snapshot.nextDispatchAt,
          queuedAt: snapshot.queuedAt,
          processingStartedAt: snapshot.processingStartedAt,
          completedAt: snapshot.completedAt,
          version: snapshot.version,
          createdAt: snapshot.createdAt,
          updatedAt: snapshot.updatedAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new UniqueConstraintError();
      throw error;
    }
    await this.insertEvents(snapshot.id, payment.pullDomainEvents());
  }

  override async lockById(id: string): Promise<Payment | undefined> {
    const transaction = this.unitOfWork.requireTransaction();
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM payments WHERE id = ${id}::uuid FOR UPDATE
    `;
    if (locked[0] === undefined) return undefined;
    const row = await transaction.payment.findUnique({ where: { id } });
    return row ? toPayment(row) : undefined;
  }

  override async lockDueForDispatch(limit: number): Promise<Payment[]> {
    const transaction = this.unitOfWork.requireTransaction();
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM payments
      WHERE status = 'PENDING'::"PaymentStatus"
        AND next_dispatch_at <= NOW()
      ORDER BY next_dispatch_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `;
    return this.loadLocked(locked.map((row) => row.id));
  }

  override async lockStalled(criteria: StalledPaymentCriteria): Promise<Payment[]> {
    const transaction = this.unitOfWork.requireTransaction();
    const locked = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM payments
      WHERE (
        status = 'PROCESSING'::"PaymentStatus"
        AND processing_started_at <= NOW() - (${criteria.leaseMs}::int * INTERVAL '1 millisecond')
      ) OR (
        status = 'QUEUED'::"PaymentStatus"
        AND queued_at <= NOW() - (${criteria.queuedStaleMs}::int * INTERVAL '1 millisecond')
      )
      ORDER BY updated_at
      LIMIT ${criteria.limit}
      FOR UPDATE SKIP LOCKED
    `;
    return this.loadLocked(locked.map((row) => row.id));
  }

  override async save(payment: Payment): Promise<void> {
    const snapshot = payment.snapshot();
    const updated = await this.unitOfWork.client().payment.updateMany({
      where: { id: snapshot.id, version: snapshot.version },
      data: {
        amount: snapshot.amount.toMinorUnits(),
        reference: snapshot.reference,
        description: snapshot.description,
        status: snapshot.status,
        attempts: snapshot.attempts,
        failureCode: snapshot.failureCode,
        failureReason: snapshot.failureReason,
        nextDispatchAt: snapshot.nextDispatchAt,
        queuedAt: snapshot.queuedAt,
        processingStartedAt: snapshot.processingStartedAt,
        completedAt: snapshot.completedAt,
        updatedAt: snapshot.updatedAt,
        version: snapshot.version + 1,
      },
    });
    if (updated.count !== 1) {
      throw new Error(`Payment ${snapshot.id} changed concurrently`);
    }
    await this.insertEvents(snapshot.id, payment.pullDomainEvents());
    payment.confirmPersistedVersion();
  }

  override async listEvents(paymentId: string): Promise<StoredPaymentEvent[]> {
    const rows = await this.unitOfWork.client().paymentEvent.findMany({
      where: { paymentId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map(toStoredEvent);
  }

  private async loadLocked(ids: string[]): Promise<Payment[]> {
    if (ids.length === 0) return [];
    const rows = await this.unitOfWork
      .client()
      .payment.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toPayment(row)] : [];
    });
  }

  private async insertEvents(
    paymentId: string,
    events: PaymentDomainEvent[],
  ): Promise<void> {
    if (events.length === 0) return;
    await this.unitOfWork.client().paymentEvent.createMany({
      data: events.map((event) => ({
        id: this.ids.next(),
        paymentId,
        type: event.type,
        attempt: event.attempt,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        metadata: event.metadata === null ? Prisma.DbNull : event.metadata,
        occurredAt: event.occurredAt,
      })),
    });
  }
}

function toPayment(row: PaymentRow): Payment {
  return Payment.rehydrate({
    id: row.id,
    userId: row.userId,
    amount: Money.ofMinorUnits(row.amount),
    reference: row.reference,
    description: row.description,
    status: row.status,
    idempotencyKey: row.idempotencyKey,
    requestFingerprint: row.requestFingerprint,
    attempts: row.attempts,
    failureCode: row.failureCode,
    failureReason: row.failureReason,
    nextDispatchAt: row.nextDispatchAt,
    queuedAt: row.queuedAt,
    processingStartedAt: row.processingStartedAt,
    completedAt: row.completedAt,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toStoredEvent(row: EventRow): StoredPaymentEvent {
  return {
    id: row.id,
    paymentId: row.paymentId,
    type: row.type,
    attempt: row.attempt,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    metadata: asMetadata(row.metadata),
    occurredAt: row.occurredAt,
  };
}

function asMetadata(value: Prisma.JsonValue | null): EventMetadata | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const metadata: EventMetadata = {};
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      entry === null
    ) {
      metadata[key] = entry;
    }
  }
  return metadata;
}
