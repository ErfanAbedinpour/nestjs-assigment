import type { Payment } from '../domain/payment';
import type { StoredPaymentEvent } from '../domain/payment-status';

export type PaymentView = {
  id: string;
  userId: string;
  amount: string;
  reference: string;
  description: string;
  status: string;
  attempts: number;
  failureCode: string | null;
  failureReason: string | null;
  idempotencyKey: string;
  nextDispatchAt: string;
  queuedAt: string | null;
  processingStartedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentEventView = {
  id: string;
  paymentId: string;
  type: string;
  attempt: number;
  fromStatus: string | null;
  toStatus: string;
  metadata: Record<string, string | number | boolean | null> | null;
  occurredAt: string;
};

export function toPaymentView(payment: Payment): PaymentView {
  const snapshot = payment.snapshot();
  return {
    id: snapshot.id,
    userId: snapshot.userId,
    amount: snapshot.amount.toString(),
    reference: snapshot.reference,
    description: snapshot.description,
    status: snapshot.status,
    attempts: snapshot.attempts,
    failureCode: snapshot.failureCode,
    failureReason: snapshot.failureReason,
    idempotencyKey: snapshot.idempotencyKey,
    nextDispatchAt: snapshot.nextDispatchAt.toISOString(),
    queuedAt: snapshot.queuedAt?.toISOString() ?? null,
    processingStartedAt: snapshot.processingStartedAt?.toISOString() ?? null,
    completedAt: snapshot.completedAt?.toISOString() ?? null,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}

export function toPaymentEventView(event: StoredPaymentEvent): PaymentEventView {
  return {
    id: event.id,
    paymentId: event.paymentId,
    type: event.type,
    attempt: event.attempt,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    metadata: event.metadata,
    occurredAt: event.occurredAt.toISOString(),
  };
}
