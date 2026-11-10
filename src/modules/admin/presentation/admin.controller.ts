import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { AdminReports } from '../application/admin-reports';
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
  constructor(private readonly reports: AdminReports) {}

  @applyListUsers()
  @Get('users')
  users(
    @Query({ schema: pageQuerySchema }) query: PageQuery,
  ): Promise<Page<AdminUserView>> {
    return this.reports.listUsers(query);
  }

  @applyAdminUser()
  @Get('users/:id')
  user(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<AdminUserView> {
    return this.reports.user(id);
  }

  @applyUserTransactions()
  @Get('users/:id/transactions')
  transactions(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query({ schema: pageQuerySchema }) query: PageQuery,
  ): Promise<Page<AdminTransactionView>> {
    return this.reports.userTransactions(id, query);
  }

  @applyTransactionSummary()
  @Get('reports/transactions/summary')
  transactionSummary(
    @Query({ schema: summaryQuerySchema }) query: SummaryQuery,
  ): Promise<TransactionSummary> {
    return this.reports.transactionSummary(query.period, query.from, query.to);
  }

  @applyBalanceUsage()
  @Get('reports/balance-usage')
  balanceUsage(): Promise<BalanceUsage> {
    return this.reports.balanceUsage();
  }
}
