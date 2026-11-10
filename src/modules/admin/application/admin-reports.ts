import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../../../shared/domain/domain-error';
import { CachePort } from '../../../shared/application/ports/cache-port';
import { AdminQueryPort, type PageRequest } from './ports/admin-query.port';
import type {
  AdminTransactionView,
  AdminUserView,
  BalanceUsage,
  Page,
  ReportPeriod,
  TransactionSummary,
} from './admin-read-models';

const MAX_RANGE_MS = 10 * 366 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminReports {
  constructor(
    private readonly queries: AdminQueryPort,
    private readonly cache: CachePort,
    private readonly config: ConfigService,
  ) {}

  listUsers(page: PageRequest): Promise<Page<AdminUserView>> {
    return this.queries.listUsers(page);
  }

  async user(userId: string): Promise<AdminUserView> {
    const user = await this.queries.findUser(userId);
    if (!user) throw new DomainError('USER_NOT_FOUND', 'User was not found');
    return user;
  }

  async userTransactions(
    userId: string,
    page: PageRequest,
  ): Promise<Page<AdminTransactionView>> {
    const transactions = await this.queries.listUserTransactions(userId, page);
    if (!transactions) throw new DomainError('USER_NOT_FOUND', 'User was not found');
    return transactions;
  }

  async transactionSummary(
    period: ReportPeriod,
    from: Date,
    to: Date,
  ): Promise<TransactionSummary> {
    if (to.getTime() - from.getTime() > MAX_RANGE_MS) {
      throw new DomainError(
        'INVALID_REPORT_RANGE',
        'Report range cannot exceed 10 years',
      );
    }
    const key = `admin:tx-summary:${period}:${from.toISOString()}:${to.toISOString()}`;
    const cached = await this.cache.get<TransactionSummary>(key);
    if (cached) return cached;
    const summary = await this.queries.transactionSummary(period, from, to);
    await this.cache.set(key, summary, this.ttl());
    return summary;
  }

  async balanceUsage(): Promise<BalanceUsage> {
    const key = 'admin:balance-usage';
    const cached = await this.cache.get<BalanceUsage>(key);
    if (cached) return cached;
    const usage = await this.queries.balanceUsage();
    await this.cache.set(key, usage, this.ttl());
    return usage;
  }

  private ttl(): number {
    return this.config.getOrThrow<number>('admin.reportCacheTtlMs');
  }
}
