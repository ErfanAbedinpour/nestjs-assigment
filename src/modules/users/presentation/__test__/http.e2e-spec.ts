import { CqrsModule } from '@nestjs/cqrs';
import { RegisterUserHandler } from '../../application/handler/register-user.handler';
import { CreditUserHandler } from '../../application/handler/credit-user.handler';
import { GetUserHandler } from '../../application/handler/get-user.handler';
import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersController } from '../users.controller';
import { UserRepository } from '../../domain/repository/user.repository';
import { LedgerRepository } from '../../domain/repository/ledger.repository';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { configureHttpApp } from '../../../../shared/presentation/configure-http-app';
import { DomainError } from '../../../../shared/domain/error/domain.error';

describe('Users HTTP contract', () => {
  let app: INestApplication;
  let base: string;
  const register = vi.fn();
  const get = vi.fn();
  const credit = vi.fn();
  const id = '11111111-1111-4111-8111-111111111111';

  beforeAll(async () => {
    vi.spyOn(RegisterUserHandler.prototype, 'execute').mockImplementation(({ input }) =>
      register(input),
    );
    vi.spyOn(CreditUserHandler.prototype, 'execute').mockImplementation(({ input }) =>
      credit(input),
    );
    vi.spyOn(GetUserHandler.prototype, 'execute').mockImplementation(({ userId }) =>
      get(userId),
    );
    const module = await Test.createTestingModule({
      imports: [CqrsModule],
      controllers: [UsersController],
      providers: [
        RegisterUserHandler,
        CreditUserHandler,
        GetUserHandler,
        { provide: UserRepository, useValue: {} },
        { provide: LedgerRepository, useValue: {} },
        { provide: UnitOfWork, useValue: {} },
        { provide: Clock, useValue: {} },
        { provide: IdGenerator, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    configureHttpApp(app);
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  beforeEach(() => {
    register.mockReset();
    get.mockReset();
    credit.mockReset();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('validates and normalizes registration input', async () => {
    register.mockResolvedValue({ id, email: 'ada@example.com', balance: '10' });
    const response = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: ' ADA@example.com ',
        name: ' Ada ',
        initialBalance: '10',
      }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ id, balance: '10' });
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ada@example.com',
        name: 'Ada',
        initialBalance: expect.objectContaining({}),
      }),
    );
    expect(register.mock.calls[0][0].initialBalance.toString()).toBe('10');
  });

  it('rejects invalid input before calling the use case', async () => {
    const response = await fetch(`${base}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'bad', name: '' }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(register).not.toHaveBeenCalled();
  });

  it('maps domain errors and rejects invalid identifiers', async () => {
    get.mockRejectedValue(new DomainError('USER_NOT_FOUND', 'User was not found'));
    const missing = await fetch(`${base}/users/${id}`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      code: 'USER_NOT_FOUND',
      requestId: expect.any(String),
    });
    const invalid = await fetch(`${base}/users/invalid`);
    expect(invalid.status).toBe(400);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('requires an idempotency key for credits', async () => {
    const response = await fetch(`${base}/users/${id}/credits`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amount: '5' }),
    });
    expect(response.status).toBe(400);
    expect(credit).not.toHaveBeenCalled();
  });
});
