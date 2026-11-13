import { GetUserBalanceHandler } from './application/handler/get-user-balance.handler';
import { CqrsModule } from '@nestjs/cqrs';
import { RegisterUserHandler } from './application/handler/register-user.handler';
import { CreditUserHandler } from './application/handler/credit-user.handler';
import { GetUserHandler } from './application/handler/get-user.handler';
import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/infrastructure/shared.module';
import { DebitUserBalance } from './application/debit-user-balance';
import { LedgerRepository } from './domain/repository/ledger.repository';
import { UserRepository } from './domain/repository/user.repository';
import { PrismaLedgerRepository } from './infrastructure/persistence/prisma-ledger.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [SharedModule, CqrsModule],
  controllers: [UsersController],
  providers: [
    PrismaUserRepository,
    { provide: UserRepository, useExisting: PrismaUserRepository },
    PrismaLedgerRepository,
    { provide: LedgerRepository, useExisting: PrismaLedgerRepository },
    RegisterUserHandler,
    CreditUserHandler,
    GetUserHandler,
    GetUserBalanceHandler,
    DebitUserBalance,
  ],
  exports: [DebitUserBalance],
})
export class UsersModule {}
