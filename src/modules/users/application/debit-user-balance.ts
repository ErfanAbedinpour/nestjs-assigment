import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/domain/error/domain.error';
import { Money } from '../../../shared/domain/value-object/money.vo';
import { Clock } from '../../../shared/application/ports/clock';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { LedgerTransaction } from '../domain/entity/ledger-transaction.entity';
import { LedgerRepository } from '../domain/repository/ledger.repository';
import { UserRepository } from '../domain/repository/user.repository';

export type DebitUserCommand = {
  userId: string;
  amount: Money;
  paymentId: string;
  reference: string;
  description: string;
  idempotencyKey: string;
};

export type DebitUserResult = {
  transactionId: string;
  balanceAfter: Money;
  replayed: boolean;
};

/**
 * Debits one account under the caller's unit of work.
 * Domain errors are raised only before any write, so a caller can translate
 * them into a failed payment without committing a partial debit.
 */
@Injectable()
export class DebitUserBalance {
  constructor(
    private readonly users: UserRepository,
    private readonly ledger: LedgerRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: DebitUserCommand): Promise<DebitUserResult> {
    return this.unitOfWork.run(async () => {
      const existing = await this.ledger.findByIdempotencyKey(
        command.userId,
        command.idempotencyKey,
      );
      if (existing) {
        if (!existing.matchesDebit(command.amount, command.paymentId)) {
          throw new DomainError(
            'IDEMPOTENCY_KEY_REUSED',
            'Idempotency-Key was already used for a different debit',
          );
        }
        return {
          transactionId: existing.snapshot().id,
          balanceAfter: existing.snapshot().balanceAfter,
          replayed: true,
        };
      }

      const user = await this.users.lockById(command.userId);
      if (!user) throw new DomainError('USER_NOT_FOUND', 'User was not found');

      // The row lock serializes debits. Re-check the key so a waiter replays
      // the committed debit instead of inserting a second one.
      const raced = await this.ledger.findByIdempotencyKey(
        command.userId,
        command.idempotencyKey,
      );
      if (raced) {
        if (!raced.matchesDebit(command.amount, command.paymentId)) {
          throw new DomainError(
            'IDEMPOTENCY_KEY_REUSED',
            'Idempotency-Key was already used for a different debit',
          );
        }
        return {
          transactionId: raced.snapshot().id,
          balanceAfter: raced.snapshot().balanceAfter,
          replayed: true,
        };
      }

      const now = this.clock.now();
      const balanceAfter = user.debit(command.amount, now);
      const entry = LedgerTransaction.debit({
        id: this.ids.next(),
        userId: command.userId,
        amount: command.amount,
        balanceAfter,
        paymentId: command.paymentId,
        reference: command.reference,
        description: command.description,
        idempotencyKey: command.idempotencyKey,
        createdAt: now,
      });
      await this.users.save(user);
      await this.ledger.append(entry);
      return { transactionId: entry.snapshot().id, balanceAfter, replayed: false };
    });
  }
}
