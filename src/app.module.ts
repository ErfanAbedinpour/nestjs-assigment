import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [ConfigModule, InfrastructureModule, UsersModule, PaymentsModule, AdminModule],
})
export class AppModule {}
