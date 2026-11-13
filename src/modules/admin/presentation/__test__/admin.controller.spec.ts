import { QueryBus } from '@nestjs/cqrs';
import { describe, expect, it, vi } from 'vitest';
import { AdminController } from '../admin.controller';
import { ListAdminUsersQuery } from '../../application/query/list-admin-users.query';
import { GetAdminUserQuery } from '../../application/query/get-admin-user.query';
import { GetAdminUserTransactionsQuery } from '../../application/query/get-admin-user-transactions.query';
import { GetTransactionSummaryQuery } from '../../application/query/get-transaction-summary.query';
import { GetBalanceUsageQuery } from '../../application/query/get-balance-usage.query';

describe('AdminController', () => {
  it('dispatches each report query with its parameters', async () => {
    const execute = vi.fn();
    const controller = new AdminController({ execute } as unknown as QueryBus);
    const page = { page: 1, pageSize: 10 };
    const from = new Date('2026-01-01');
    const to = new Date('2026-02-01');
    await controller.users(page);
    await controller.user('u');
    await controller.transactions('u', page);
    await controller.transactionSummary({ period: 'monthly', from, to });
    await controller.balanceUsage();
    expect(execute.mock.calls.map(([query]) => query.constructor)).toEqual([
      ListAdminUsersQuery,
      GetAdminUserQuery,
      GetAdminUserTransactionsQuery,
      GetTransactionSummaryQuery,
      GetBalanceUsageQuery,
    ]);
    expect(execute.mock.calls[2][0]).toMatchObject({ userId: 'u', page });
  });
});
