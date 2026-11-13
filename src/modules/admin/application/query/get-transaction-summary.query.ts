import { Query } from '@nestjs/cqrs';
import type { ReportPeriod, TransactionSummary } from '../admin-read-models';
export class GetTransactionSummaryQuery extends Query<TransactionSummary> {
  constructor(
    public readonly period: ReportPeriod,
    public readonly from: Date,
    public readonly to: Date,
  ) {
    super();
  }
}
