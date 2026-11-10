import { Injectable } from '@nestjs/common';
import { Money } from '../../../../shared/domain/money';
import { DebitUserBalance } from '../../../users/application/debit-user-balance';
import { GetUser } from '../../../users/application/get-user';
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
    private readonly getUser: GetUser,
  ) {}

  async debit(command: AccountDebitCommand): Promise<void> {
    await this.debitUserBalance.execute(command);
  }

  async exists(userId: string): Promise<boolean> {
    return (await this.getUser.balanceOf(userId)) !== undefined;
  }

  async balanceCovers(userId: string, amount: Money): Promise<boolean> {
    const balance = await this.getUser.balanceOf(userId);
    return balance !== undefined && balance >= amount.toMinorUnits();
  }
}
