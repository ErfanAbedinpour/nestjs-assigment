export const PaymentStatus = {
  Pending: 'PENDING',
  Queued: 'QUEUED',
  Processing: 'PROCESSING',
  Succeeded: 'SUCCEEDED',
  Failed: 'FAILED',
  Cancelled: 'CANCELLED',
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentEventType = {
  Created: 'CREATED',
  Queued: 'QUEUED',
  ProcessingStarted: 'PROCESSING_STARTED',
  Succeeded: 'SUCCEEDED',
  Failed: 'FAILED',
  RetryTriggered: 'RETRY_TRIGGERED',
  Cancelled: 'CANCELLED',
} as const;

export type PaymentEventType = (typeof PaymentEventType)[keyof typeof PaymentEventType];

export const FailureCode = {
  Technical: 'TECHNICAL_FAILURE',
  Simulated: 'SIMULATED_FAILURE',
  InsufficientBalance: 'INSUFFICIENT_BALANCE',
} as const;

export type FailureCode = (typeof FailureCode)[keyof typeof FailureCode];

export type EventMetadata = Record<string, string | number | boolean | null>;

export type PaymentDomainEvent = {
  type: PaymentEventType;
  attempt: number;
  fromStatus: PaymentStatus | null;
  toStatus: PaymentStatus;
  metadata: EventMetadata | null;
  occurredAt: Date;
};

export type StoredPaymentEvent = PaymentDomainEvent & {
  id: string;
  paymentId: string;
};
