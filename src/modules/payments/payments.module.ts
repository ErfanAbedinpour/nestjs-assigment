import { CqrsModule } from '@nestjs/cqrs';
import { GetPaymentEventsHandler } from './application/handler/get-payment-events.handler';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMqModule } from '../../infrastructure/messaging/rabbitmq/rabbitmq.module';
import { RandomSource } from '../../shared/application/ports/random-source';
import { SharedModule } from '../../shared/infrastructure/shared.module';
import { UsersModule } from '../users/users.module';
import { AccountDebitPort, AccountLookupPort } from './application/ports/account-ports';
import { CancelPaymentHandler } from './application/handler/cancel-payment.handler';
import { DispatchPendingPaymentsHandler } from './application/handler/dispatch-pending-payments.handler';
import { PaymentFailureSimulator } from './application/ports/failure-simulator.port';
import { GetPaymentHandler } from './application/handler/get-payment.handler';
import { PaymentQueuePort } from './application/ports/payment-queue.port';
import { ProcessPaymentHandler } from './application/handler/process-payment.handler';
import { RecoverStalledPaymentsHandler } from './application/handler/recover-stalled-payments.handler';
import { RetryPaymentHandler } from './application/handler/retry-payment.handler';
import { SubmitPaymentHandler } from './application/handler/submit-payment.handler';
import { PaymentRepository } from './domain/repository/payment.repository';
import { RetryPolicy } from './domain/policy/retry.policy';
import { AmountBasedFailureSimulator } from './infrastructure/adapters/amount-failure-simulator';
import { UsersAccountAdapter } from './infrastructure/adapters/users-account.adapter';
import { PaymentQueueTopology } from './infrastructure/messaging/payment-queue.topology';
import { RabbitPaymentQueue } from './infrastructure/messaging/rabbit-payment-queue';
import { PrismaPaymentRepository } from './infrastructure/persistence/prisma-payment.repository';
import { PaymentsController } from './presentation/payments.controller';

@Module({
  imports: [SharedModule, UsersModule, RabbitMqModule, CqrsModule],
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
    SubmitPaymentHandler,
    DispatchPendingPaymentsHandler,
    ProcessPaymentHandler,
    RecoverStalledPaymentsHandler,
    RetryPaymentHandler,
    CancelPaymentHandler,
    GetPaymentHandler,
    GetPaymentEventsHandler,
  ],
  exports: [PaymentQueueTopology],
})
export class PaymentsModule {}
