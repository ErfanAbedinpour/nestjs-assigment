import { Query } from '@nestjs/cqrs';
import type { PaymentView } from '../payment.view';
export class GetPaymentQuery extends Query<PaymentView> {
  constructor(public readonly paymentId: string) {
    super();
  }
}
