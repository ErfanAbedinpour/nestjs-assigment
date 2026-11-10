import type { User } from '../domain/user';
import type { LedgerTransaction } from '../domain/ledger-transaction';

export type UserView = {
  id: string;
  email: string;
  name: string;
  balance: string;
  createdAt: string;
  updatedAt: string;
};

export type CreditView = {
  transactionId: string;
  userId: string;
  type: 'CREDIT';
  amount: string;
  balanceAfter: string;
  idempotencyKey: string;
  createdAt: string;
  replayed: boolean;
};

export function toUserView(user: User): UserView {
  const snapshot = user.snapshot();
  return {
    id: snapshot.id,
    email: snapshot.email,
    name: snapshot.name,
    balance: snapshot.balance.toString(),
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toCreditView(entry: LedgerTransaction, replayed: boolean): CreditView {
  const snapshot = entry.snapshot();
  return {
    transactionId: snapshot.id,
    userId: snapshot.userId,
    type: 'CREDIT',
    amount: snapshot.amount.toString(),
    balanceAfter: snapshot.balanceAfter.toString(),
    idempotencyKey: snapshot.idempotencyKey,
    createdAt: snapshot.createdAt.toISOString(),
    replayed,
  };
}
