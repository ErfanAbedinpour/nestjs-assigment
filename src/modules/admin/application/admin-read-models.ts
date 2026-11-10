export type ReportPeriod = 'daily' | 'monthly' | 'yearly';

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminUserView = {
  id: string;
  email: string;
  name: string;
  balance: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminTransactionView = {
  id: string;
  userId: string;
  type: string;
  amount: string;
  balanceAfter: string;
  paymentId: string | null;
  reference: string | null;
  description: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type TransactionSummary = {
  period: ReportPeriod;
  from: string;
  to: string;
  buckets: Array<{
    periodStart: string;
    credits: string;
    debits: string;
    net: string;
  }>;
};

export type BalanceUsage = {
  items: Array<{
    userId: string;
    email: string;
    name: string;
    balance: string;
    totalCredits: string;
    totalDebits: string;
  }>;
};
