import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { SharedModule } from '../../shared/infrastructure/shared.module';
import { AdminQueryPort } from './application/ports/admin-query.port';
import { AdminReports } from './application/admin-reports';
import { PrismaAdminQuery } from './infrastructure/persistence/prisma-admin-query';
import { AdminController } from './presentation/admin.controller';
import { AdminApiKeyGuard } from './presentation/admin.guard';

@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [AdminController],
  providers: [
    PrismaAdminQuery,
    { provide: AdminQueryPort, useExisting: PrismaAdminQuery },
    AdminReports,
    AdminApiKeyGuard,
  ],
})
export class AdminModule {}
