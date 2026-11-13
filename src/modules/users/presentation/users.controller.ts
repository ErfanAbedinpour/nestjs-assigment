import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Money } from '../../../shared/domain/value-object/money.vo';
import { IdempotencyKey } from '../../../shared/presentation/idempotency-key.decorator';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { RegisterUserCommand } from '../application/command/register-user.command';
import { CreditUserCommand } from '../application/command/credit-user.command';
import { GetUserQuery } from '../application/query/get-user.query';
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
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @applyRegisterUser()
  @Post()
  register(
    @Body({ schema: registerUserSchema }) body: RegisterUserBody,
  ): Promise<UserView> {
    return this.commandBus.execute(
      new RegisterUserCommand({
        email: body.email,
        name: body.name,
        ...(body.initialBalance !== undefined
          ? { initialBalance: Money.positive(body.initialBalance) }
          : {}),
      }),
    );
  }

  @applyGetUser()
  @Get(':id')
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<UserView> {
    return this.queryBus.execute(new GetUserQuery(id));
  }

  @applyCreditUser()
  @Post(':id/credits')
  credit(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @IdempotencyKey() idempotencyKey: string,
    @Body({ schema: creditUserSchema }) body: CreditUserBody,
  ): Promise<CreditView> {
    return this.commandBus.execute(
      new CreditUserCommand({
        userId: id,
        amount: Money.positive(body.amount),
        idempotencyKey,
        ...(body.reference !== undefined ? { reference: body.reference } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      }),
    );
  }
}
