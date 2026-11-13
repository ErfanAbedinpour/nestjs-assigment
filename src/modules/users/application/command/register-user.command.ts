import { Command } from '@nestjs/cqrs';
import type { Money } from '../../../../shared/domain/value-object/money.vo';

export type RegisterUserInput = {
  email: string;
  name: string;
  initialBalance?: Money;
};
import type { UserView } from '../user.view';

export class RegisterUserCommand extends Command<UserView> {
  constructor(public readonly input: RegisterUserInput) {
    super();
  }
}
