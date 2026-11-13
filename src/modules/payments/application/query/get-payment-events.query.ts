import { Query } from '@nestjs/cqrs';
import type { PaymentEventView } from '../payment.view';
export class GetPaymentEventsQuery extends Query<PaymentEventView[]> {
  constructor(public readonly paymentId: string) {
    super();
  }
}
