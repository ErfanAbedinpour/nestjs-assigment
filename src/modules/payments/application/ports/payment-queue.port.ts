export type PaymentQueueMessage = {
  paymentId: string;
};

/** Outbound port for the processing queue. Publishing must confirm or throw. */
export abstract class PaymentQueuePort {
  abstract publish(message: PaymentQueueMessage): Promise<void>;
}
