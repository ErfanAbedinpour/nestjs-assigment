import { Logger } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { ProcessPaymentCommand } from '../command/process-payment.command';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import { Money } from '../../../../shared/domain/value-object/money.vo';
import { Clock } from '../../../../shared/application/ports/clock';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { Payment } from '../../domain/aggregation/payment.aggregate';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { FailureCode, PaymentStatus } from '../../domain/types/payment-status.types';
import { RetryPolicy } from '../../domain/policy/retry.policy';
import { AccountDebitPort, AccountLookupPort } from '../ports/account-ports';
import { PaymentFailureSimulator } from '../ports/failure-simulator.port';
import { truncateReason } from '../payment-fingerprint';

type ClaimedAttempt = {
  attempt: number;
  userId: string;
  amount: Money;
  reference: string;
};

/**
 * Processes one queue delivery.
 *
 * Claim and settlement are separate transactions. The gateway stand-in runs
 * between them, so a database transaction is never held open across that call.
 * Settlement debits only when the row is still PROCESSING for the claimed attempt.
 */
@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentHandler {
  private readonly logger = new Logger(ProcessPaymentHandler.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly accounts: AccountDebitPort,
    private readonly accountLookup: AccountLookupPort,
    private readonly simulator: PaymentFailureSimulator,
    private readonly retryPolicy: RetryPolicy,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute({ paymentId }: ProcessPaymentCommand): Promise<void> {
    const claimed = await this.claim(paymentId);
    if (!claimed) return;

    let failure: { code: string; reason: string } | undefined;
    try {
      // The debit still checks the balance under a lock. Bypass the simulator
      // when funds are already insufficient so a simulated outage cannot mask
      // the business failure and spend the automatic retry budget.
      if (!(await this.accountLookup.balanceCovers(claimed.userId, claimed.amount))) {
        await this.settle(paymentId, claimed.attempt);
        return;
      }
      const simulation = this.simulator.evaluate({
        amount: claimed.amount,
        reference: claimed.reference,
      });
      if (simulation.kind === 'technical') {
        failure = { code: simulation.code, reason: simulation.reason };
      }
    } catch (error) {
      failure = { code: FailureCode.Technical, reason: errorText(error) };
    }

    if (failure) {
      await this.recordTechnicalFailure(
        paymentId,
        claimed.attempt,
        failure.code,
        failure.reason,
      );
      return;
    }

    try {
      await this.settle(paymentId, claimed.attempt);
    } catch (error) {
      await this.recordTechnicalFailure(
        paymentId,
        claimed.attempt,
        FailureCode.Technical,
        errorText(error),
      );
    }
  }

  private async claim(paymentId: string): Promise<ClaimedAttempt | undefined> {
    return this.unitOfWork.run(async () => {
      const payment = await this.payments.lockById(paymentId);
      if (!payment) {
        this.logger.warn(`payment.missing paymentId=${paymentId}`);
        return undefined;
      }
      if (payment.snapshot().status !== PaymentStatus.Queued) {
        this.logger.log(
          `payment.duplicate_delivery paymentId=${paymentId} status=${payment.snapshot().status}`,
        );
        return undefined;
      }
      const attempt = payment.claim(this.clock.now());
      await this.payments.save(payment);
      const snapshot = payment.snapshot();
      this.logger.log(`payment.processing paymentId=${paymentId} attempt=${attempt}`);
      return {
        attempt,
        userId: snapshot.userId,
        amount: snapshot.amount,
        reference: snapshot.reference,
      };
    });
  }

  private async settle(paymentId: string, attempt: number): Promise<void> {
    await this.unitOfWork.run(async () => {
      const payment = await this.payments.lockById(paymentId);
      // A reconciler may have reclaimed the lease while this attempt was in flight.
      if (!payment || !payment.isProcessingAttempt(attempt)) {
        this.logger.warn(
          `payment.stale_attempt paymentId=${paymentId} attempt=${attempt}`,
        );
        return;
      }
      await this.applyOutcome(payment, attempt);
      await this.payments.save(payment);
    });
  }

  /**
   * Account debit raises domain errors before it writes. Catching them here
   * therefore records a business failure without persisting a debit.
   */
  private async applyOutcome(payment: Payment, attempt: number): Promise<void> {
    const snapshot = payment.snapshot();
    try {
      await this.accounts.debit({
        userId: snapshot.userId,
        amount: snapshot.amount,
        paymentId: snapshot.id,
        reference: snapshot.reference,
        description: snapshot.description,
        idempotencyKey: `payment:${snapshot.id}`,
      });
      payment.succeed(this.clock.now());
      this.logger.log(`payment.succeeded paymentId=${snapshot.id} attempt=${attempt}`);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      payment.failBusiness(error.code, truncateReason(error.message), this.clock.now());
      this.logger.warn(
        `payment.failed_business paymentId=${snapshot.id} code=${error.code}`,
      );
    }
  }

  private async recordTechnicalFailure(
    paymentId: string,
    attempt: number,
    code: string,
    reason: string,
  ): Promise<void> {
    const truncated = truncateReason(reason);
    await this.unitOfWork.run(async () => {
      const payment = await this.payments.lockById(paymentId);
      if (!payment || !payment.isProcessingAttempt(attempt)) {
        this.logger.warn(
          `payment.technical_failure_ignored paymentId=${paymentId} attempt=${attempt}`,
        );
        return;
      }
      const decision = this.retryPolicy.decide(payment.snapshot().attempts);
      payment.failTechnical({
        now: this.clock.now(),
        code,
        reason: truncated,
        decision,
        source: 'worker',
      });
      await this.payments.save(payment);
      this.logger.warn(
        `payment.technical_failure paymentId=${paymentId} attempt=${attempt} retry=${decision.retry} delayMs=${decision.delayMs}`,
      );
    });
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Technical payment failure';
}
