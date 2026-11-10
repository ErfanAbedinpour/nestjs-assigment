import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqModule } from '../../infrastructure/messaging/rabbitmq/rabbitmq.module';
import { RandomSource } from '../../shared/application/ports/random-source';
import { SharedModule } from '../../shared/infrastructure/shared.module';
import { UsersModule } from '../users/users.module';
import { AccountDebitPort, AccountLookupPort } from './application/ports/account-ports';
import { CancelPayment } from './application/cancel-payment';
import { DispatchPendingPayments } from './application/dispatch-pending-payments';
import { PaymentFailureSimulator } from './application/ports/failure-simulator.port';
import { GetPayment } from './application/get-payment';
import { PaymentQueuePort } from './application/ports/payment-queue.port';
import { ProcessPayment } from './application/process-payment';
import { RecoverStalledPayments } from './application/recover-stalled-payments';
import { RetryPayment } from './application/retry-payment';
import { SubmitPayment } from './application/submit-payment';
import { PaymentRepository } from './domain/payment.repository';
import { RetryPolicy } from './domain/retry-policy';
import { AmountBasedFailureSimulator } from './infrastructure/adapters/amount-failure-simulator';
import { UsersAccountAdapter } from './infrastructure/adapters/users-account.adapter';
import { PaymentQueueTopology } from './infrastructure/messaging/payment-queue.topology';
import { RabbitPaymentQueue } from './infrastructure/messaging/rabbit-payment-queue';
import { PrismaPaymentRepository } from './infrastructure/persistence/prisma-payment.repository';
import { PaymentsController } from './presentation/payments.controller';

@Module({
  imports: [SharedModule, UsersModule, RabbitMqModule],
  controllers: [PaymentsController],
  providers: [
    PrismaPaymentRepository,
    { provide: PaymentRepository, useExisting: PrismaPaymentRepository },
    UsersAccountAdapter,
    { provide: AccountDebitPort, useExisting: UsersAccountAdapter },
    { provide: AccountLookupPort, useExisting: UsersAccountAdapter },
    PaymentQueueTopology,
    RabbitPaymentQueue,
    { provide: PaymentQueuePort, useExisting: RabbitPaymentQueue },
    {
      provide: RetryPolicy,
      inject: [ConfigService, RandomSource],
      useFactory: (config: ConfigService, random: RandomSource): RetryPolicy =>
        new RetryPolicy(
          config.getOrThrow<number>('payments.retry.maxAttempts'),
          config.getOrThrow<number>('payments.retry.baseDelayMs'),
          config.getOrThrow<number>('payments.retry.maxDelayMs'),
          config.getOrThrow<number>('payments.retry.jitterRatio'),
          random,
        ),
    },
    {
      provide: PaymentFailureSimulator,
      inject: [ConfigService, RandomSource],
      useFactory: (
        config: ConfigService,
        random: RandomSource,
      ): AmountBasedFailureSimulator =>
        new AmountBasedFailureSimulator(
          config.getOrThrow<string>('payments.failurePerMinorUnit'),
          config.getOrThrow<string>('payments.maxFailureProbability'),
          config.get<string[]>('payments.forcedReferencePatterns') ?? [],
          random,
        ),
    },
    SubmitPayment,
    DispatchPendingPayments,
    ProcessPayment,
    RecoverStalledPayments,
    RetryPayment,
    CancelPayment,
    GetPayment,
  ],
  exports: [
    PaymentQueueTopology,
    ProcessPayment,
    DispatchPendingPayments,
    RecoverStalledPayments,
  ],
})
export class PaymentsModule {}
