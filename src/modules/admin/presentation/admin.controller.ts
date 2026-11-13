import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ListAdminUsersQuery } from '../application/query/list-admin-users.query';
import { GetAdminUserQuery } from '../application/query/get-admin-user.query';
import { GetAdminUserTransactionsQuery } from '../application/query/get-admin-user-transactions.query';
import { GetTransactionSummaryQuery } from '../application/query/get-transaction-summary.query';
import { GetBalanceUsageQuery } from '../application/query/get-balance-usage.query';
import type {
  AdminTransactionView,
  AdminUserView,
  BalanceUsage,
  Page,
  TransactionSummary,
} from '../application/admin-read-models';
import { AdminApiKeyGuard } from './admin.guard';
import {
  pageQuerySchema,
  summaryQuerySchema,
  type PageQuery,
  type SummaryQuery,
} from './admin.schemas';
import {
  applyAdminController,
  applyAdminUser,
  applyBalanceUsage,
  applyListUsers,
  applyTransactionSummary,
  applyUserTransactions,
} from './admin.api';

@applyAdminController()
@Controller('admin')
@UseGuards(AdminApiKeyGuard)
export class AdminController {
  constructor(private readonly queries: QueryBus) {}

  @applyListUsers()
  @Get('users')
  users(
    @Query({ schema: pageQuerySchema }) query: PageQuery,
  ): Promise<Page<AdminUserView>> {
    return this.queries.execute(new ListAdminUsersQuery(query));
  }

  @applyAdminUser()
  @Get('users/:id')
  user(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminUserView> {
    return this.queries.execute(new GetAdminUserQuery(id));
  }

  @applyUserTransactions()
  @Get('users/:id/transactions')
  transactions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query({ schema: pageQuerySchema }) query: PageQuery,
  ): Promise<Page<AdminTransactionView>> {
    return this.queries.execute(new GetAdminUserTransactionsQuery(id, query));
  }

  @applyTransactionSummary()
  @Get('reports/transactions/summary')
  transactionSummary(
    @Query({ schema: summaryQuerySchema }) query: SummaryQuery,
  ): Promise<TransactionSummary> {
    return this.queries.execute(
      new GetTransactionSummaryQuery(query.period, query.from, query.to),
    );
  }

  @applyBalanceUsage()
  @Get('reports/balance-usage')
  balanceUsage(): Promise<BalanceUsage> {
    return this.queries.execute(new GetBalanceUsageQuery());
  }
}
