import { Module } from '@nestjs/common';
import { SharedModule } from '../../shared/infrastructure/shared.module';
import { CreditUserAccount } from './application/credit-user-account';
import { DebitUserBalance } from './application/debit-user-balance';
import { GetUser } from './application/get-user';
import { RegisterUser } from './application/register-user';
import { LedgerRepository } from './domain/ledger.repository';
import { UserRepository } from './domain/user.repository';
import { PrismaLedgerRepository } from './infrastructure/persistence/prisma-ledger.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository';
import { UsersController } from './presentation/users.controller';

@Module({
  imports: [SharedModule],
  controllers: [UsersController],
  providers: [
    PrismaUserRepository,
    { provide: UserRepository, useExisting: PrismaUserRepository },
    PrismaLedgerRepository,
    { provide: LedgerRepository, useExisting: PrismaLedgerRepository },
    RegisterUser,
    CreditUserAccount,
    GetUser,
    DebitUserBalance,
  ],
  exports: [GetUser, DebitUserBalance],
})
export class UsersModule {}
