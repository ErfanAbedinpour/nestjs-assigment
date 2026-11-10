import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Money } from '../../../shared/domain/money';
import { IdempotencyKey } from '../../../shared/presentation/idempotency-key.decorator';
import { CreditUserAccount } from '../application/credit-user-account';
import { GetUser } from '../application/get-user';
import { RegisterUser } from '../application/register-user';
import type { CreditView, UserView } from '../application/user.view';
import {
  CreditUserBody,
  RegisterUserBody,
  creditUserSchema,
  registerUserSchema,
} from './user.schemas';
import {
  applyCreditUser,
  applyGetUser,
  applyRegisterUser,
  applyUsersController,
} from './users.api';

@applyUsersController()
@Controller('users')
export class UsersController {
  constructor(
    private readonly registerUser: RegisterUser,
    private readonly getUser: GetUser,
    private readonly creditUser: CreditUserAccount,
  ) {}

  @applyRegisterUser()
  @Post()
  register(
    @Body({ schema: registerUserSchema }) body: RegisterUserBody,
  ): Promise<UserView> {
    return this.registerUser.execute({
      email: body.email,
      name: body.name,
      ...(body.initialBalance !== undefined
        ? { initialBalance: Money.positive(body.initialBalance) }
        : {}),
    });
  }

  @applyGetUser()
  @Get(':id')
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UserView> {
    return this.getUser.execute(id);
  }

  @applyCreditUser()
  @Post(':id/credits')
  credit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @IdempotencyKey() idempotencyKey: string,
    @Body({ schema: creditUserSchema }) body: CreditUserBody,
  ): Promise<CreditView> {
    return this.creditUser.execute({
      userId: id,
      amount: Money.positive(body.amount),
      idempotencyKey,
      ...(body.reference !== undefined ? { reference: body.reference } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
    });
  }
}
