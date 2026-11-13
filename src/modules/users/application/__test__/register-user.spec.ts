import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Money } from '../../../../shared/domain/value-object/money.vo';
import { UniqueConstraintError } from '../../../../shared/application/unique-constraint.error';
import { UserRepository } from '../../domain/repository/user.repository';
import { LedgerRepository } from '../../domain/repository/ledger.repository';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { RegisterUserHandler } from '../handler/register-user.handler';
import { RegisterUserCommand } from '../command/register-user.command';
import { GetUserQuery } from '../query/get-user.query';
import { GetUserBalanceQuery } from '../query/get-user-balance.query';
import { GetUserBalanceHandler } from '../handler/get-user-balance.handler';
import { GetUserHandler } from '../handler/get-user.handler';
import { User } from '../../domain/aggregation/user.aggregate';

describe('user application services', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  let users: {
    insert: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let ledger: { append: ReturnType<typeof vi.fn> };
  let register: RegisterUserHandler;

  beforeEach(() => {
    users = { insert: vi.fn(), save: vi.fn(), findById: vi.fn() };
    ledger = { append: vi.fn() };
    let nextId = 0;
    register = new RegisterUserHandler(
      users as unknown as UserRepository,
      ledger as unknown as LedgerRepository,
      { run: async (work) => work() } as UnitOfWork,
      { next: () => `id-${++nextId}` },
      { now: () => now },
    );
  });

  it('registers an account with no opening ledger entry', async () => {
    const result = await register.execute(
      new RegisterUserCommand({ email: 'a@example.com', name: 'A' }),
    );
    expect(result).toMatchObject({ id: 'id-1', balance: '0' });
    expect(users.insert).toHaveBeenCalledOnce();
    expect(users.save).not.toHaveBeenCalled();
    expect(ledger.append).not.toHaveBeenCalled();
  });

  it('records an opening balance in the ledger', async () => {
    const result = await register.execute(
      new RegisterUserCommand({
        email: 'a@example.com',
        name: 'A',
        initialBalance: Money.positive('125'),
      }),
    );
    expect(result.balance).toBe('125');
    expect(users.save).toHaveBeenCalledOnce();
    expect(ledger.append.mock.calls[0][0].snapshot()).toMatchObject({
      id: 'id-2',
      userId: 'id-1',
      type: 'CREDIT',
      idempotencyKey: 'registration:id-1',
    });
    expect(ledger.append.mock.calls[0][0].snapshot().amount.toString()).toBe('125');
  });

  it('maps a uniqueness conflict but propagates unexpected errors', async () => {
    users.insert.mockRejectedValueOnce(new UniqueConstraintError());
    await expect(
      register.execute(new RegisterUserCommand({ email: 'a@example.com', name: 'A' })),
    ).rejects.toMatchObject({ code: 'USER_ALREADY_EXISTS' });
    const failure = new Error('database unavailable');
    users.insert.mockRejectedValueOnce(failure);
    await expect(
      register.execute(new RegisterUserCommand({ email: 'a@example.com', name: 'A' })),
    ).rejects.toBe(failure);
  });

  it('returns a user view and balance, and handles missing users', async () => {
    const service = new GetUserHandler(users as unknown as UserRepository);
    users.findById
      .mockResolvedValueOnce(
        User.register({ id: 'u', email: 'a@example.com', name: 'A', now }),
      )
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    await expect(service.execute(new GetUserQuery('u'))).resolves.toMatchObject({
      id: 'u',
      balance: '0',
    });
    await expect(
      new GetUserBalanceHandler(users as unknown as UserRepository).execute(
        new GetUserBalanceQuery('missing'),
      ),
    ).resolves.toBeUndefined();
    await expect(service.execute(new GetUserQuery('missing'))).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});
