import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared/domain/value-object/money.vo';
import { DebitUserBalance } from '../../../users/application/debit-user-balance';
import { QueryBus } from '@nestjs/cqrs';
import { GetUserBalanceQuery } from '../../../users/application/query/get-user-balance.query';
import {
  AccountDebitPort,
  AccountLookupPort,
  type AccountDebitCommand,
} from '../../application/ports/account-ports';

/** Adapts the users module to the ports the payment use cases depend on. */
@Injectable()
export class UsersAccountAdapter implements AccountDebitPort, AccountLookupPort {
  constructor(
    private readonly debitUserBalance: DebitUserBalance,
    private readonly queries: QueryBus,
  ) {}

  async debit(command: AccountDebitCommand): Promise<void> {
    await this.debitUserBalance.execute(command);
  }

  async exists(userId: string): Promise<boolean> {
    return (await this.queries.execute(new GetUserBalanceQuery(userId))) !== undefined;
  }

  async balanceCovers(userId: string, amount: Money): Promise<boolean> {
    const balance = await this.queries.execute(new GetUserBalanceQuery(userId));
    return balance !== undefined && balance >= amount.toMinorUnits();
  }
}
