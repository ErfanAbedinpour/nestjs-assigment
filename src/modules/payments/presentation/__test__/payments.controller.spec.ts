import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { describe, expect, it, vi } from 'vitest';
import { PaymentsController } from '../payments.controller';
import { SubmitPaymentCommand } from '../../application/command/submit-payment.command';
import { RetryPaymentCommand } from '../../application/command/retry-payment.command';
import { CancelPaymentCommand } from '../../application/command/cancel-payment.command';
import { GetPaymentQuery } from '../../application/query/get-payment.query';
import { GetPaymentEventsQuery } from '../../application/query/get-payment-events.query';

describe('PaymentsController', () => {
  it('dispatches payment commands and queries with the supplied inputs', async () => {
    const commands = { execute: vi.fn().mockResolvedValue({ id: 'p' }) };
    const queries = { execute: vi.fn().mockResolvedValue({ id: 'p' }) };
    const controller = new PaymentsController(
      commands as unknown as CommandBus,
      queries as unknown as QueryBus,
    );
    await expect(
      controller.submit('key', {
        userId: 'u',
        amount: '100',
        reference: 'r',
        description: 'd',
      }),
    ).resolves.toEqual({ id: 'p' });
    const submit = commands.execute.mock.calls[0][0] as SubmitPaymentCommand;
    expect(submit).toBeInstanceOf(SubmitPaymentCommand);
    expect(submit.input).toMatchObject({ userId: 'u', idempotencyKey: 'key' });
    expect(submit.input.amount.toString()).toBe('100');
    await controller.retry('p');
    await controller.cancel('p');
    await controller.get('p');
    await controller.events('p');
    expect(commands.execute).toHaveBeenCalledWith(expect.any(RetryPaymentCommand));
    expect(commands.execute).toHaveBeenCalledWith(expect.any(CancelPaymentCommand));
    expect(queries.execute).toHaveBeenCalledWith(expect.any(GetPaymentQuery));
    expect(queries.execute).toHaveBeenCalledWith(expect.any(GetPaymentEventsQuery));
  });

  it('rejects nonpositive amounts before dispatch', () => {
    const execute = vi.fn();
    const controller = new PaymentsController(
      { execute } as unknown as CommandBus,
      { execute } as unknown as QueryBus,
    );
    expect(() =>
      controller.submit('key', {
        userId: 'u',
        amount: '0',
        reference: 'r',
        description: 'd',
      }),
    ).toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
