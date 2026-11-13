import { Query } from '@nestjs/cqrs';
import type { BalanceUsage } from '../admin-read-models';
export class GetBalanceUsageQuery extends Query<BalanceUsage> {
  constructor() {
    super();
  }
}
