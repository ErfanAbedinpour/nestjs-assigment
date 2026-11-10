import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { DomainError } from '../../../shared/domain/domain-error';
import { Money } from '../../../shared/domain/money';
import {
  FailureCode,
  PaymentEventType,
  PaymentStatus,
  type EventMetadata,
  type PaymentDomainEvent,
} from './payment-status';
import type { RetryDecision } from './retry-policy';

export type PaymentSnapshot = {
  id: string;
  userId: string;
  amount: Money;
  reference: string;
  description: string;
  status: PaymentStatus;
  idempotencyKey: string;
  requestFingerprint: string;
  attempts: number;
  failureCode: string | null;
  failureReason: string | null;
  nextDispatchAt: Date;
  queuedAt: Date | null;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

type TechnicalFailure = {
  now: Date;
  code: string;
  reason: string;
  decision: RetryDecision;
  source: 'worker' | 'reconciler';
};

/**
 * Payment aggregate and its state machine.
 *
 * A debit is allowed only while the payment is PROCESSING for the attempt that
 * claimed it. Losing the processing lease therefore makes a late worker a no-op
 * instead of a second debit.
 */
export class Payment extends AggregateRoot<PaymentDomainEvent> {
  private constructor(private state: PaymentSnapshot) {
    super();
  }

  static submit(input: {
    id: string;
    userId: string;
    amount: Money;
    reference: string;
    description: string;
    idempotencyKey: string;
    requestFingerprint: string;
    now: Date;
  }): Payment {
    const payment = new Payment({
      id: input.id,
      userId: input.userId,
      amount: input.amount,
      reference: input.reference,
      description: input.description,
      status: PaymentStatus.Pending,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint: input.requestFingerprint,
      attempts: 0,
      failureCode: null,
      failureReason: null,
      nextDispatchAt: input.now,
      queuedAt: null,
      processingStartedAt: null,
      completedAt: null,
      version: 0,
      createdAt: input.now,
      updatedAt: input.now,
    });
    payment.recordEvent(PaymentEventType.Created, null, input.now, null);
    return payment;
  }

  static rehydrate(snapshot: PaymentSnapshot): Payment {
    return new Payment(snapshot);
  }

  snapshot(): PaymentSnapshot {
    return this.state;
  }

  /** Bumps the version the repository just committed. */
  confirmPersistedVersion(): void {
    this.state = { ...this.state, version: this.state.version + 1 };
  }

  isProcessingAttempt(attempt: number): boolean {
    return (
      this.state.status === PaymentStatus.Processing && this.state.attempts === attempt
    );
  }

  markQueued(now: Date): void {
    this.assertStatus(PaymentStatus.Pending);
    this.state = {
      ...this.state,
      status: PaymentStatus.Queued,
      queuedAt: now,
      updatedAt: now,
    };
    this.recordEvent(PaymentEventType.Queued, PaymentStatus.Pending, now, null);
  }

  /** Claims a queued payment. The returned attempt fences the later settlement. */
  claim(now: Date): number {
    this.assertStatus(PaymentStatus.Queued);
    const attempt = this.state.attempts + 1;
    const from = this.state.status;
    this.state = {
      ...this.state,
      status: PaymentStatus.Processing,
      attempts: attempt,
      processingStartedAt: now,
      failureCode: null,
      failureReason: null,
      updatedAt: now,
    };
    this.recordEvent(PaymentEventType.ProcessingStarted, from, now, null);
    return attempt;
  }

  succeed(now: Date): void {
    this.assertStatus(PaymentStatus.Processing);
    const from = this.state.status;
    this.state = {
      ...this.state,
      status: PaymentStatus.Succeeded,
      completedAt: now,
      failureCode: null,
      failureReason: null,
      updatedAt: now,
    };
    this.recordEvent(PaymentEventType.Succeeded, from, now, null);
  }

  failBusiness(code: string, reason: string, now: Date): void {
    this.assertStatus(PaymentStatus.Processing);
    this.fail(code, reason, now, null);
  }

  /**
   * Technical failures return to PENDING when the retry budget remains.
   * The next dispatch time lives on the row, so a broker retry is not required.
   */
  failTechnical(input: TechnicalFailure): void {
    this.assertStatus(PaymentStatus.Processing);
    if (!input.decision.retry) {
      this.fail(input.code, input.reason, input.now, {
        source: input.source,
        retriesExhausted: true,
      });
      return;
    }

    const from = this.state.status;
    const nextDispatchAt = new Date(input.now.getTime() + input.decision.delayMs);
    this.state = {
      ...this.state,
      status: PaymentStatus.Pending,
      failureCode: input.code,
      failureReason: input.reason,
      nextDispatchAt,
      queuedAt: null,
      processingStartedAt: null,
      updatedAt: input.now,
    };
    this.recordEvent(PaymentEventType.RetryTriggered, from, input.now, {
      source: input.source,
      delayMs: input.decision.delayMs,
      reason: input.reason,
    });
  }

  /** A queued message that was never consumed is dispatched again without spending an attempt. */
  requeueLostMessage(now: Date): void {
    this.assertStatus(PaymentStatus.Queued);
    const from = this.state.status;
    this.state = {
      ...this.state,
      status: PaymentStatus.Pending,
      queuedAt: null,
      nextDispatchAt: now,
      updatedAt: now,
    };
    this.recordEvent(PaymentEventType.RetryTriggered, from, now, {
      source: 'reconciler',
      reason: 'Queued message was not consumed before it went stale',
    });
  }

  /**
   * Starts a fresh attempt budget. The caller decides whether the failure is
   * allowed to be retried; insufficient funds stays blocked until the balance covers it.
   */
  retryManually(now: Date): void {
    this.assertStatus(PaymentStatus.Failed);
    const from = this.state.status;
    this.state = {
      ...this.state,
      status: PaymentStatus.Pending,
      attempts: 0,
      failureCode: null,
      failureReason: null,
      completedAt: null,
      queuedAt: null,
      processingStartedAt: null,
      nextDispatchAt: now,
      updatedAt: now,
    };
    this.recordEvent(PaymentEventType.RetryTriggered, from, now, { source: 'manual' });
  }

  cancel(now: Date): void {
    if (
      this.state.status !== PaymentStatus.Pending &&
      this.state.status !== PaymentStatus.Queued
    ) {
      throw new DomainError(
        'PAYMENT_NOT_CANCELLABLE',
        'Only pending or queued payments can be cancelled',
      );
    }
    const from = this.state.status;
    this.state = {
      ...this.state,
      status: PaymentStatus.Cancelled,
      completedAt: now,
      updatedAt: now,
    };
    this.recordEvent(PaymentEventType.Cancelled, from, now, null);
  }

  private fail(
    code: string,
    reason: string,
    now: Date,
    metadata: EventMetadata | null,
  ): void {
    const from = this.state.status;
    this.state = {
      ...this.state,
      status: PaymentStatus.Failed,
      failureCode: code,
      failureReason: reason,
      completedAt: now,
      updatedAt: now,
    };
    this.recordEvent(PaymentEventType.Failed, from, now, metadata);
  }

  private assertStatus(expected: PaymentStatus): void {
    if (this.state.status !== expected) {
      throw new DomainError(
        'INVALID_PAYMENT_TRANSITION',
        `Payment cannot transition from ${this.state.status} when ${expected} is required`,
      );
    }
  }

  private recordEvent(
    type: PaymentDomainEvent['type'],
    fromStatus: PaymentStatus | null,
    occurredAt: Date,
    metadata: EventMetadata | null,
  ): void {
    this.record({
      type,
      attempt: this.state.attempts,
      fromStatus,
      toStatus: this.state.status,
      metadata,
      occurredAt,
    });
  }
}

export function canRetryManually(
  failureCode: string | null,
  balanceCoversAmount: boolean,
): boolean {
  if (failureCode === FailureCode.Technical || failureCode === FailureCode.Simulated) {
    return true;
  }
  return failureCode === FailureCode.InsufficientBalance && balanceCoversAmount;
}
