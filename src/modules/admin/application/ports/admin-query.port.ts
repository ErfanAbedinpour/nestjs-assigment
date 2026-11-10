import type {
  AdminTransactionView,
  AdminUserView,
  BalanceUsage,
  Page,
  ReportPeriod,
  TransactionSummary,
} from '../admin-read-models';

export type PageRequest = {
  page: number;
  pageSize: number;
};

export abstract class AdminQueryPort {
  abstract listUsers(page: PageRequest): Promise<Page<AdminUserView>>;
  abstract findUser(userId: string): Promise<AdminUserView | undefined>;
  abstract listUserTransactions(
    userId: string,
    page: PageRequest,
  ): Promise<Page<AdminTransactionView> | undefined>;
  abstract transactionSummary(
    period: ReportPeriod,
    from: Date,
    to: Date,
  ): Promise<TransactionSummary>;
  abstract balanceUsage(): Promise<BalanceUsage>;
}
