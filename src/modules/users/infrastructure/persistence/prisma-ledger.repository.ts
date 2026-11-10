import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared/domain/money';
import { UniqueConstraintError } from '../../../../shared/application/unique-constraint.error';
import { isUniqueConstraintError } from '../../../../shared/infrastructure/persistence/prisma-errors';
import { PrismaUnitOfWork } from '../../../../shared/infrastructure/persistence/prisma-unit-of-work';
import { LedgerTransaction, type TransactionType } from '../../domain/ledger-transaction';
import { LedgerRepository } from '../../domain/ledger.repository';

type LedgerRow = {
  id: string;
  userId: string;
  type: TransactionType;
  amount: bigint;
  balanceAfter: bigint;
  paymentId: string | null;
  reference: string | null;
  description: string | null;
  idempotencyKey: string;
  createdAt: Date;
};

@Injectable()
export class PrismaLedgerRepository extends LedgerRepository {
  constructor(private readonly unitOfWork: PrismaUnitOfWork) {
    super();
  }

  override async findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<LedgerTransaction | undefined> {
    const row = await this.unitOfWork.client().ledgerEntry.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    return row ? toLedgerTransaction(row) : undefined;
  }

  override async append(entry: LedgerTransaction): Promise<void> {
    const snapshot = entry.snapshot();
    try {
      await this.unitOfWork.client().ledgerEntry.create({
        data: {
          id: snapshot.id,
          userId: snapshot.userId,
          type: snapshot.type,
          amount: snapshot.amount.toMinorUnits(),
          balanceAfter: snapshot.balanceAfter.toMinorUnits(),
          paymentId: snapshot.paymentId,
          reference: snapshot.reference,
          description: snapshot.description,
          idempotencyKey: snapshot.idempotencyKey,
          createdAt: snapshot.createdAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) throw new UniqueConstraintError();
      throw error;
    }
  }
}

function toLedgerTransaction(row: LedgerRow): LedgerTransaction {
  return LedgerTransaction.rehydrate({
    id: row.id,
    userId: row.userId,
    type: row.type,
    amount: Money.ofMinorUnits(row.amount),
    balanceAfter: Money.ofMinorUnits(row.balanceAfter),
    paymentId: row.paymentId,
    reference: row.reference,
    description: row.description,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt,
  });
}
