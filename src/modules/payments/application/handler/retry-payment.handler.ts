import { Logger } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { RetryPaymentCommand } from '../command/retry-payment.command';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import { Clock } from '../../../../shared/application/ports/clock';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { canRetryManually } from '../../domain/aggregation/payment.aggregate';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { FailureCode, PaymentStatus } from '../../domain/types/payment-status.types';
import { AccountLookupPort } from '../ports/account-ports';
import { CommandBus } from '@nestjs/cqrs';
import { DispatchPendingPaymentsCommand } from '../command/dispatch-pending-payments.command';
import { toPaymentView, type PaymentView } from '../payment.view';

@CommandHandler(RetryPaymentCommand)
export class RetryPaymentHandler {
  private readonly logger = new Logger(RetryPaymentHandler.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly accounts: AccountLookupPort,
    private readonly commands: CommandBus,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute({ paymentId }: RetryPaymentCommand): Promise<PaymentView> {
    await this.unitOfWork.run(async () => {
      const payment = await this.payments.lockById(paymentId);
      if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment was not found');

      const snapshot = payment.snapshot();
      if (snapshot.status !== PaymentStatus.Failed) {
        throw new DomainError(
          'PAYMENT_NOT_RETRYABLE',
          'Only failed payments can be retried',
        );
      }

      const covered = await this.accounts.balanceCovers(snapshot.userId, snapshot.amount);
      if (!canRetryManually(snapshot.failureCode, covered)) {
        throw new DomainError(
          'PAYMENT_NOT_RETRYABLE',
          snapshot.failureCode === FailureCode.InsufficientBalance
            ? 'Balance is still insufficient for this payment'
            : 'This failure cannot be retried',
        );
      }

      payment.retryManually(this.clock.now());
      await this.payments.save(payment);
      this.logger.log(`payment.manual_retry paymentId=${paymentId}`);
    });

    try {
      await this.commands.execute(new DispatchPendingPaymentsCommand(paymentId));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown dispatch failure';
      this.logger.warn(
        `payment.dispatch_fast_path_failed paymentId=${paymentId} reason=${reason}`,
      );
    }

    const current = await this.payments.findById(paymentId);
    if (!current) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment was not found');
    return toPaymentView(current);
  }
}
