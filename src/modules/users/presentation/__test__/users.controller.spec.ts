import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { describe, expect, it, vi } from 'vitest';
import { UsersController } from '../users.controller';
import { RegisterUserCommand } from '../../application/command/register-user.command';
import { CreditUserCommand } from '../../application/command/credit-user.command';
import { GetUserQuery } from '../../application/query/get-user.query';

describe('UsersController', () => {
  it('dispatches registration, lookup and credit requests', async () => {
    const commands = { execute: vi.fn() };
    const queries = { execute: vi.fn() };
    const controller = new UsersController(
      commands as unknown as CommandBus,
      queries as unknown as QueryBus,
    );
    await controller.register({
      email: 'a@example.com',
      name: 'A',
      initialBalance: '100',
    });
    const registration = commands.execute.mock.calls[0][0] as RegisterUserCommand;
    expect(registration.input.initialBalance?.toString()).toBe('100');
    await controller.register({ email: 'a@example.com', name: 'A' });
    expect(
      (commands.execute.mock.calls[1][0] as RegisterUserCommand).input.initialBalance,
    ).toBeUndefined();
    await controller.credit('u', 'k', { amount: '5', reference: 'r', description: 'd' });
    expect(commands.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          userId: 'u',
          idempotencyKey: 'k',
          reference: 'r',
          description: 'd',
        }),
      }),
    );
    expect(commands.execute.mock.calls[2][0]).toBeInstanceOf(CreditUserCommand);
    await controller.credit('u', 'k2', { amount: '5' });
    expect(
      (commands.execute.mock.calls[3][0] as CreditUserCommand).input,
    ).not.toHaveProperty('reference');
    expect(
      (commands.execute.mock.calls[3][0] as CreditUserCommand).input,
    ).not.toHaveProperty('description');
    await controller.get('u');
    expect(queries.execute).toHaveBeenCalledWith(expect.any(GetUserQuery));
  });
});
