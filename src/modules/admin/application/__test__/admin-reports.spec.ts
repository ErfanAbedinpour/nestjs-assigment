import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CachePort } from '../../../../shared/application/ports/cache-port';
import { AdminQueryPort } from '../ports/admin-query.port';
import { ListAdminUsersHandler } from '../handler/list-admin-users.handler';
import { ListAdminUsersQuery } from '../query/list-admin-users.query';
import { GetAdminUserHandler } from '../handler/get-admin-user.handler';
import { GetAdminUserQuery } from '../query/get-admin-user.query';
import { GetAdminUserTransactionsHandler } from '../handler/get-admin-user-transactions.handler';
import { GetAdminUserTransactionsQuery } from '../query/get-admin-user-transactions.query';
import { GetTransactionSummaryHandler } from '../handler/get-transaction-summary.handler';
import { GetTransactionSummaryQuery } from '../query/get-transaction-summary.query';
import { GetBalanceUsageHandler } from '../handler/get-balance-usage.handler';
import { GetBalanceUsageQuery } from '../query/get-balance-usage.query';
import type { PageRequest } from '../ports/admin-query.port';
import type { ReportPeriod } from '../admin-read-models';

describe('AdminReports', () => {
  let queries: {
    listUsers: ReturnType<typeof vi.fn>;
    findUser: ReturnType<typeof vi.fn>;
    listUserTransactions: ReturnType<typeof vi.fn>;
    transactionSummary: ReturnType<typeof vi.fn>;
    balanceUsage: ReturnType<typeof vi.fn>;
  };
  let cache: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let reports: {
    listUsers: (page: PageRequest) => ReturnType<ListAdminUsersHandler['execute']>;
    user: (id: string) => ReturnType<GetAdminUserHandler['execute']>;
    userTransactions: (
      id: string,
      page: PageRequest,
    ) => ReturnType<GetAdminUserTransactionsHandler['execute']>;
    transactionSummary: (
      period: ReportPeriod,
      from: Date,
      to: Date,
    ) => ReturnType<GetTransactionSummaryHandler['execute']>;
    balanceUsage: () => ReturnType<GetBalanceUsageHandler['execute']>;
  };
  beforeEach(() => {
    queries = {
      listUsers: vi.fn(),
      findUser: vi.fn(),
      listUserTransactions: vi.fn(),
      transactionSummary: vi.fn(),
      balanceUsage: vi.fn(),
    };
    cache = { get: vi.fn(), set: vi.fn() };
    const port = queries as unknown as AdminQueryPort;
    const cachePort = cache as unknown as CachePort;
    const config = { getOrThrow: () => 60000 } as unknown as ConfigService;
    const list = new ListAdminUsersHandler(port);
    const user = new GetAdminUserHandler(port);
    const transactions = new GetAdminUserTransactionsHandler(port);
    const summary = new GetTransactionSummaryHandler(port, cachePort, config);
    const usage = new GetBalanceUsageHandler(port, cachePort, config);
    reports = {
      listUsers: (page) => list.execute(new ListAdminUsersQuery(page)),
      user: (id) => user.execute(new GetAdminUserQuery(id)),
      userTransactions: (id, page) =>
        transactions.execute(new GetAdminUserTransactionsQuery(id, page)),
      transactionSummary: (period, from, to) =>
        summary.execute(new GetTransactionSummaryQuery(period, from, to)),
      balanceUsage: () => usage.execute(new GetBalanceUsageQuery()),
    };
  });

  it('returns user data and reports missing users', async () => {
    const page = { page: 1, pageSize: 10 };
    const result = { items: [], total: 0, ...page };
    queries.listUsers.mockResolvedValue(result);
    queries.findUser.mockResolvedValueOnce({ id: 'u' }).mockResolvedValueOnce(undefined);
    queries.listUserTransactions
      .mockResolvedValueOnce(result)
      .mockResolvedValueOnce(undefined);
    await expect(reports.listUsers(page)).resolves.toEqual(result);
    await expect(reports.user('u')).resolves.toEqual({ id: 'u' });
    await expect(reports.user('missing')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
    await expect(reports.userTransactions('u', page)).resolves.toEqual(result);
    await expect(reports.userTransactions('missing', page)).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });

  it('caches summaries and uses cached results', async () => {
    const from = new Date('2025-01-01T00:00:00Z');
    const to = new Date('2025-02-01T00:00:00Z');
    const summary = {
      period: 'monthly',
      from: from.toISOString(),
      to: to.toISOString(),
      buckets: [],
    };
    queries.transactionSummary.mockResolvedValue(summary);
    cache.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(summary);
    await expect(reports.transactionSummary('monthly', from, to)).resolves.toEqual(
      summary,
    );
    await expect(reports.transactionSummary('monthly', from, to)).resolves.toEqual(
      summary,
    );
    expect(queries.transactionSummary).toHaveBeenCalledOnce();
    expect(cache.set).toHaveBeenCalledWith(
      `admin:tx-summary:monthly:${from.toISOString()}:${to.toISOString()}`,
      summary,
      60000,
    );
    await expect(
      reports.transactionSummary('yearly', from, new Date('2040-01-01')),
    ).rejects.toMatchObject({ code: 'INVALID_REPORT_RANGE' });
  });

  it('caches balance usage', async () => {
    const usage = { items: [] };
    queries.balanceUsage.mockResolvedValue(usage);
    cache.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce(usage);
    await expect(reports.balanceUsage()).resolves.toEqual(usage);
    await expect(reports.balanceUsage()).resolves.toEqual(usage);
    expect(queries.balanceUsage).toHaveBeenCalledOnce();
    expect(cache.set).toHaveBeenCalledWith('admin:balance-usage', usage, 60000);
  });
});
