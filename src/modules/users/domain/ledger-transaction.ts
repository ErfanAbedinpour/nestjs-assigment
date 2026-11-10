import { Money } from '../../../shared/domain/money';

export type TransactionType = 'CREDIT' | 'DEBIT';

export type LedgerTransactionSnapshot = {
  id: string;
  userId: string;
  type: TransactionType;
  amount: Money;
  balanceAfter: Money;
  paymentId: string | null;
  reference: string | null;
  description: string | null;
  idempotencyKey: string;
  createdAt: Date;
};

/** Immutable ledger line. Rows are appended and never updated. */
export class LedgerTransaction {
  private constructor(private readonly state: LedgerTransactionSnapshot) {}

  static credit(input: {
    id: string;
    userId: string;
    amount: Money;
    balanceAfter: Money;
    reference: string | null;
    description: string | null;
    idempotencyKey: string;
    createdAt: Date;
  }): LedgerTransaction {
    return new LedgerTransaction({
      id: input.id,
      userId: input.userId,
      type: 'CREDIT',
      amount: input.amount,
      balanceAfter: input.balanceAfter,
      paymentId: null,
      reference: input.reference,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.createdAt,
    });
  }

  static debit(input: {
    id: string;
    userId: string;
    amount: Money;
    balanceAfter: Money;
    paymentId: string;
    reference: string;
    description: string;
    idempotencyKey: string;
    createdAt: Date;
  }): LedgerTransaction {
    return new LedgerTransaction({
      id: input.id,
      userId: input.userId,
      type: 'DEBIT',
      amount: input.amount,
      balanceAfter: input.balanceAfter,
      paymentId: input.paymentId,
      reference: input.reference,
      description: input.description,
      idempotencyKey: input.idempotencyKey,
      createdAt: input.createdAt,
    });
  }

  static rehydrate(snapshot: LedgerTransactionSnapshot): LedgerTransaction {
    return new LedgerTransaction(snapshot);
  }

  snapshot(): LedgerTransactionSnapshot {
    return this.state;
  }

  matchesCredit(amount: Money): boolean {
    return this.state.type === 'CREDIT' && this.state.amount.equals(amount);
  }

  matchesDebit(amount: Money, paymentId: string): boolean {
    return (
      this.state.type === 'DEBIT' &&
      this.state.amount.equals(amount) &&
      this.state.paymentId === paymentId
    );
  }
}
