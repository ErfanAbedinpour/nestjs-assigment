import { Query } from '@nestjs/cqrs';
import type { AdminTransactionView, Page } from '../admin-read-models';
import type { PageRequest } from '../ports/admin-query.port';
export class GetAdminUserTransactionsQuery extends Query<Page<AdminTransactionView>> {
  constructor(
    public readonly userId: string,
    public readonly page: PageRequest,
  ) {
    super();
  }
}
