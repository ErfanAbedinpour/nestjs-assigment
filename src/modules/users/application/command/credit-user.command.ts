import { Command } from '@nestjs/cqrs';
import type { Money } from '../../../../shared/domain/value-object/money.vo';

export type CreditUserInput = {
  userId: string;
  amount: Money;
  idempotencyKey: string;
  reference?: string;
  description?: string;
};
import type { CreditView } from '../user.view';

export class CreditUserCommand extends Command<CreditView> {
  constructor(public readonly input: CreditUserInput) {
    super();
  }
}
