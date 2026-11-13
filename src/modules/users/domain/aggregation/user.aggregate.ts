import { DomainError } from '../../../../shared/domain/error/domain.error';
import { Money } from '../../../../shared/domain/value-object/money.vo';

export type UserSnapshot = {
  id: string;
  email: string;
  name: string;
  balance: Money;
  createdAt: Date;
  updatedAt: Date;
};

export type RegisterUserProps = {
  id: string;
  email: string;
  name: string;
  now: Date;
};

/**
 * Account aggregate. Balance changes only through credit and debit, and debit
 * refuses to cross zero. Persistence must lock the row before calling either method.
 */
export class User {
  private state: UserSnapshot;

  private constructor({ id, email, name, balance, createdAt, updatedAt }: UserSnapshot) {
    this.state = {
      id,
      email,
      name,
      balance,
      createdAt,
      updatedAt,
    };
  }

  static register(input: RegisterUserProps): User {
    return new User({
      id: input.id,
      email: input.email,
      name: input.name,
      balance: Money.zero(),
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  static rehydrate(snapshot: UserSnapshot): User {
    return new User(snapshot);
  }

  credit(amount: Money, now: Date): Money {
    assertPositive(amount);
    this.state = {
      ...this.state,
      balance: this.state.balance.add(amount),
      updatedAt: now,
    };
    return this.state.balance;
  }

  /**
   * Rejects before mutating when the balance cannot cover the amount.
   * Callers can catch the domain error without rolling back an earlier write.
   */
  debit(amount: Money, now: Date): Money {
    assertPositive(amount);
    if (!this.state.balance.greaterThanOrEqual(amount)) {
      throw new DomainError(
        'INSUFFICIENT_BALANCE',
        'User balance is insufficient for this payment',
        {
          available: this.state.balance.toString(),
          requested: amount.toString(),
        },
      );
    }
    this.state = {
      ...this.state,
      balance: this.state.balance.subtract(amount),
      updatedAt: now,
    };
    return this.state.balance;
  }

  snapshot(): UserSnapshot {
    return this.state;
  }
}

function assertPositive(amount: Money): void {
  if (amount.toMinorUnits() <= 0n) {
    throw new DomainError('INVALID_AMOUNT', 'Amount must be greater than zero');
  }
}
