import { QueryHandler } from '@nestjs/cqrs';
import { AdminQueryPort } from '../ports/admin-query.port';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import type { AdminTransactionView, Page } from '../admin-read-models';
import { GetAdminUserTransactionsQuery } from '../query/get-admin-user-transactions.query';
@QueryHandler(GetAdminUserTransactionsQuery)
export class GetAdminUserTransactionsHandler {
  constructor(private readonly queries: AdminQueryPort) {}
  async execute({
    userId,
    page,
  }: GetAdminUserTransactionsQuery): Promise<Page<AdminTransactionView>> {
    const transactions = await this.queries.listUserTransactions(userId, page);
    if (!transactions) throw new DomainError('USER_NOT_FOUND', 'User was not found');
    return transactions;
  }
}
