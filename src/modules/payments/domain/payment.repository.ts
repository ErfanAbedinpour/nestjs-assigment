import type { Payment } from './payment';
import type { StoredPaymentEvent } from './payment-status';

export type StalledPaymentCriteria = {
  leaseMs: number;
  queuedStaleMs: number;
  limit: number;
};

export abstract class PaymentRepository {
  abstract findById(id: string): Promise<Payment | undefined>;
  abstract findByIdempotencyKey(
    userId: string,
    idempotencyKey: string,
  ): Promise<Payment | undefined>;
  abstract insert(payment: Payment): Promise<void>;
  /** Row-level lock. Must be called inside an active unit of work. */
  abstract lockById(id: string): Promise<Payment | undefined>;
  /** Locks due PENDING rows, skipping rows already locked by another dispatcher. */
  abstract lockDueForDispatch(limit: number): Promise<Payment[]>;
  /** Locks PROCESSING rows past their lease and QUEUED rows past their staleness window. */
  abstract lockStalled(criteria: StalledPaymentCriteria): Promise<Payment[]>;
  abstract save(payment: Payment): Promise<void>;
  abstract listEvents(paymentId: string): Promise<StoredPaymentEvent[]>;
}
