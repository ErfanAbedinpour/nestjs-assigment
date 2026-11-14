import { QueryHandler } from '@nestjs/cqrs';
import { AdminQueryPort } from '../ports/admin-query.port';
import { CachePort } from '../../../../shared/application/ports/cache-port';
import { ConfigService } from '@nestjs/config';
import type { BalanceUsage } from '../admin-read-models';
import { CoalesceRequests } from '../../../../shared/application/coalesce-requests';
import { GetBalanceUsageQuery } from '../query/get-balance-usage.query';
@QueryHandler(GetBalanceUsageQuery)
export class GetBalanceUsageHandler {
  private readonly coalescer = new CoalesceRequests();
  constructor(
    private readonly queries: AdminQueryPort,
    private readonly cache: CachePort,
    private readonly config: ConfigService,
  ) {}
  async execute(_query: GetBalanceUsageQuery): Promise<BalanceUsage> {
    const key = 'admin:balance-usage';
    const cached = await this.cache.get<BalanceUsage>(key);
    if (cached) return cached;
    return this.coalescer.run(key, async () => {
      const usage = await this.queries.balanceUsage();
      await this.cache.set(
        key,
        usage,
        this.config.getOrThrow<number>('admin.reportCacheTtlMs'),
      );
      return usage;
    });
  }
}
