import { QueryHandler } from '@nestjs/cqrs';
import { AdminQueryPort } from '../ports/admin-query.port';
import { CachePort } from '../../../../shared/application/ports/cache-port';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import type { TransactionSummary } from '../admin-read-models';
import { GetTransactionSummaryQuery } from '../query/get-transaction-summary.query';
const MAX_RANGE_MS = 10 * 366 * 24 * 60 * 60 * 1000;
@QueryHandler(GetTransactionSummaryQuery)
export class GetTransactionSummaryHandler {
  constructor(
    private readonly queries: AdminQueryPort,
    private readonly cache: CachePort,
    private readonly config: ConfigService,
  ) {}
  async execute({
    period,
    from,
    to,
  }: GetTransactionSummaryQuery): Promise<TransactionSummary> {
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
    await this.cache.set(
      key,
      summary,
      this.config.getOrThrow<number>('admin.reportCacheTtlMs'),
    );
    return summary;
  }
}
