import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/domain/domain-error';
import { Money } from '../../../shared/domain/money';
import { Clock } from '../../../shared/application/ports/clock';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { UniqueConstraintError } from '../../../shared/application/unique-constraint.error';
import { UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { LedgerTransaction } from '../domain/ledger-transaction';
import { LedgerRepository } from '../domain/ledger.repository';
import { UserRepository } from '../domain/user.repository';
import { toCreditView, type CreditView } from './user.view';

export type CreditUserCommand = {
  userId: string;
  amount: Money;
  idempotencyKey: string;
  reference?: string;
  description?: string;
};

@Injectable()
export class CreditUserAccount {
  constructor(
    private readonly users: UserRepository,
    private readonly ledger: LedgerRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreditUserCommand): Promise<CreditView> {
    try {
      return await this.unitOfWork.run(() => this.credit(command));
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) throw error;
      // The competing request committed the same key. Replay it if it is the same credit.
      const existing = await this.ledger.findByIdempotencyKey(
        command.userId,
        command.idempotencyKey,
      );
      if (!existing) throw error;
      return this.replay(existing, command.amount);
    }
  }

  private async credit(command: CreditUserCommand): Promise<CreditView> {
    const existing = await this.ledger.findByIdempotencyKey(
      command.userId,
      command.idempotencyKey,
    );
    if (existing) return this.replay(existing, command.amount);

    const user = await this.users.lockById(command.userId);
    if (!user) throw new DomainError('USER_NOT_FOUND', 'User was not found');

    // Re-read after the lock: a concurrent request may have committed this key
    // while this transaction was waiting.
    const raced = await this.ledger.findByIdempotencyKey(
      command.userId,
      command.idempotencyKey,
    );
    if (raced) return this.replay(raced, command.amount);

    const now = this.clock.now();
    const balanceAfter = user.credit(command.amount, now);
    const entry = LedgerTransaction.credit({
      id: this.ids.next(),
      userId: command.userId,
      amount: command.amount,
      balanceAfter,
      reference: command.reference ?? null,
      description: command.description ?? null,
      idempotencyKey: command.idempotencyKey,
      createdAt: now,
    });
    await this.users.save(user);
    await this.ledger.append(entry);
    return toCreditView(entry, false);
  }

  private replay(existing: LedgerTransaction, amount: Money): CreditView {
    if (!existing.matchesCredit(amount)) {
      throw new DomainError(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency-Key was already used for a different credit',
      );
    }
    return toCreditView(existing, true);
  }
}
