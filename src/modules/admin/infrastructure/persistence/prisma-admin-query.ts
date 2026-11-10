import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service';
import { AdminQueryPort, type PageRequest } from '../../application/ports/admin-query.port';
import type {
  AdminTransactionView,
  AdminUserView,
  BalanceUsage,
  Page,
  ReportPeriod,
  TransactionSummary,
} from '../../application/admin-read-models';

type UserRow = {
  id: string;
  email: string;
  name: string;
  balance: bigint;
  createdAt: Date;
  updatedAt: Date;
};

type TransactionRow = {
  id: string;
  userId: string;
  type: string;
  amount: bigint;
  balanceAfter: bigint;
  paymentId: string | null;
  reference: string | null;
  description: string | null;
  idempotencyKey: string;
  createdAt: Date;
};

type SummaryRow = {
  period_start: Date;
  credits: bigint | string | number;
  debits: bigint | string | number;
};

type UsageRow = {
  id: string;
  email: string;
  name: string;
  balance: bigint | string | number;
  total_credits: bigint | string | number;
  total_debits: bigint | string | number;
};

@Injectable()
export class PrismaAdminQuery extends AdminQueryPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  override async listUsers(page: PageRequest): Promise<Page<AdminUserView>> {
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset(page),
        take: page.pageSize,
      }),
      this.prisma.user.count(),
    ]);
    return { items: rows.map(toUser), page: page.page, pageSize: page.pageSize, total };
  }

  override async findUser(userId: string): Promise<AdminUserView | undefined> {
    const row = await this.prisma.user.findUnique({ where: { id: userId } });
    return row ? toUser(row) : undefined;
  }

  override async listUserTransactions(
    userId: string,
    page: PageRequest,
  ): Promise<Page<AdminTransactionView> | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) return undefined;
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset(page),
        take: page.pageSize,
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);
    return {
      items: rows.map(toTransaction),
      page: page.page,
      pageSize: page.pageSize,
      total,
    };
  }

  override async transactionSummary(
    period: ReportPeriod,
    from: Date,
    to: Date,
  ): Promise<TransactionSummary> {
    const unit = period === 'daily' ? 'day' : period === 'monthly' ? 'month' : 'year';
    const rows = await this.prisma.$queryRaw<SummaryRow[]>`
      SELECT date_trunc(${unit}, created_at) AS period_start,
             COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT'::"TransactionType"), 0)::bigint AS credits,
             COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'::"TransactionType"), 0)::bigint AS debits
      FROM transactions
      WHERE created_at >= ${from} AND created_at < ${to}
      GROUP BY 1
      ORDER BY 1
    `;
    return {
      period,
      from: from.toISOString(),
      to: to.toISOString(),
      buckets: rows.map((row) => {
        const credits = asBigInt(row.credits);
        const debits = asBigInt(row.debits);
        return {
          periodStart: new Date(row.period_start).toISOString(),
          credits: credits.toString(),
          debits: debits.toString(),
          net: (credits - debits).toString(),
        };
      }),
    };
  }

  override async balanceUsage(): Promise<BalanceUsage> {
    const rows = await this.prisma.$queryRaw<UsageRow[]>`
      SELECT u.id,
             u.email,
             u.name,
             u.balance,
             COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'CREDIT'::"TransactionType"), 0)::bigint AS total_credits,
             COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'DEBIT'::"TransactionType"), 0)::bigint AS total_debits
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id
      GROUP BY u.id
      ORDER BY total_debits DESC, u.email ASC
    `;
    return {
      items: rows.map((row) => ({
        userId: row.id,
        email: row.email,
        name: row.name,
        balance: asBigInt(row.balance).toString(),
        totalCredits: asBigInt(row.total_credits).toString(),
        totalDebits: asBigInt(row.total_debits).toString(),
      })),
    };
  }
}

function offset(page: PageRequest): number {
  return (page.page - 1) * page.pageSize;
}

function toUser(row: UserRow): AdminUserView {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    balance: row.balance.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTransaction(row: TransactionRow): AdminTransactionView {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    amount: row.amount.toString(),
    balanceAfter: row.balanceAfter.toString(),
    paymentId: row.paymentId,
    reference: row.reference,
    description: row.description,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
  };
}

function asBigInt(value: bigint | string | number): bigint {
  return typeof value === 'bigint' ? value : BigInt(value);
}
