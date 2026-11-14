import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PaymentConsumer } from './modules/payments/infrastructure/messaging/payment.consumer';
import { PaymentDispatchPoller } from './modules/payments/infrastructure/polling/payment-dispatch.poller';
import { PaymentRecoveryPoller } from './modules/payments/infrastructure/polling/payment-recovery.poller';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [ConfigModule, InfrastructureModule, CqrsModule, PaymentsModule],
  controllers: [PaymentConsumer],
  providers: [PaymentDispatchPoller, PaymentRecoveryPoller],
})
export class WorkerModule {}
