import type { Money } from '../../../../shared/domain/value-object/money.vo';

export type AccountDebitCommand = {
  userId: string;
  amount: Money;
  paymentId: string;
  reference: string;
  description: string;
  idempotencyKey: string;
};

/** Debits an account inside the unit of work already opened by the caller. */
export abstract class AccountDebitPort {
  abstract debit(command: AccountDebitCommand): Promise<void>;
}

export abstract class AccountLookupPort {
  abstract exists(userId: string): Promise<boolean>;
  abstract balanceCovers(userId: string, amount: Money): Promise<boolean>;
}
