import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { SharedModule } from '../../shared/infrastructure/shared.module';
import { AdminQueryPort } from './application/ports/admin-query.port';
import { CqrsModule } from '@nestjs/cqrs';
import { ListAdminUsersHandler } from './application/handler/list-admin-users.handler';
import { GetAdminUserHandler } from './application/handler/get-admin-user.handler';
import { GetAdminUserTransactionsHandler } from './application/handler/get-admin-user-transactions.handler';
import { GetTransactionSummaryHandler } from './application/handler/get-transaction-summary.handler';
import { GetBalanceUsageHandler } from './application/handler/get-balance-usage.handler';
import { PrismaAdminQuery } from './infrastructure/persistence/prisma-admin-query';
import { AdminController } from './presentation/admin.controller';
import { AdminApiKeyGuard } from './presentation/admin.guard';

@Module({
  imports: [PrismaModule, SharedModule, CqrsModule],
  controllers: [AdminController],
  providers: [
    PrismaAdminQuery,
    { provide: AdminQueryPort, useExisting: PrismaAdminQuery },
    ListAdminUsersHandler,
    GetAdminUserHandler,
    GetAdminUserTransactionsHandler,
    GetTransactionSummaryHandler,
    GetBalanceUsageHandler,
    AdminApiKeyGuard,
  ],
})
export class AdminModule {}
