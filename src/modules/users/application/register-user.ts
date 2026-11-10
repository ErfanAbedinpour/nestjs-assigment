import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/domain/domain-error';
import { Money } from '../../../shared/domain/money';
import { Clock } from '../../../shared/application/ports/clock';
import { IdGenerator } from '../../../shared/application/ports/id-generator';
import { UniqueConstraintError } from '../../../shared/application/unique-constraint.error';
import { UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { LedgerTransaction } from '../domain/ledger-transaction';
import { LedgerRepository } from '../domain/ledger.repository';
import { User } from '../domain/user';
import { UserRepository } from '../domain/user.repository';
import { toUserView, type UserView } from './user.view';

export type RegisterUserCommand = {
  email: string;
  name: string;
  initialBalance?: Money;
};

@Injectable()
export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly ledger: LedgerRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /**
   * Opening balance, when present, is a ledger credit in the same transaction
   * as the account insert, so the balance and the ledger cannot diverge.
   */
  async execute(command: RegisterUserCommand): Promise<UserView> {
    const now = this.clock.now();
    const user = User.register({
      id: this.ids.next(),
      email: command.email,
      name: command.name,
      now,
    });

    try {
      await this.unitOfWork.run(async () => {
        await this.users.insert(user);
        const opening = command.initialBalance;
        if (opening !== undefined && opening.toMinorUnits() > 0n) {
          const balanceAfter = user.credit(opening, now);
          await this.users.save(user);
          await this.ledger.append(
            LedgerTransaction.credit({
              id: this.ids.next(),
              userId: user.snapshot().id,
              amount: opening,
              balanceAfter,
              reference: null,
              description: 'Opening balance',
              idempotencyKey: `registration:${user.snapshot().id}`,
              createdAt: now,
            }),
          );
        }
      });
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new DomainError(
          'USER_ALREADY_EXISTS',
          'A user with this email already exists',
        );
      }
      throw error;
    }

    return toUserView(user);
  }
}
