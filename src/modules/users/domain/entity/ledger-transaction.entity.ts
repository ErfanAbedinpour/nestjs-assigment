import { Money } from '../../../../shared/domain/value-object/money.vo';

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

export type CreditLedgerProps = {
  id: string;
  userId: string;
  amount: Money;
  balanceAfter: Money;
  reference: string | null;
  description: string | null;
  idempotencyKey: string;
  createdAt: Date;
};

export type DebitLedgerProps = Omit<CreditLedgerProps, 'reference' | 'description'> & {
  paymentId: string;
  reference: string;
  description: string;
};

/** Immutable ledger line. Rows are appended and never updated. */
export class LedgerTransaction {
  private readonly state: LedgerTransactionSnapshot;

  private constructor({
    id,
    userId,
    type,
    amount,
    balanceAfter,
    paymentId,
    reference,
    description,
    idempotencyKey,
    createdAt,
  }: LedgerTransactionSnapshot) {
    this.state = {
      id,
      userId,
      type,
      amount,
      balanceAfter,
      paymentId,
      reference,
      description,
      idempotencyKey,
      createdAt,
    };
  }

  static credit(input: CreditLedgerProps): LedgerTransaction {
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

  static debit(input: DebitLedgerProps): LedgerTransaction {
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
