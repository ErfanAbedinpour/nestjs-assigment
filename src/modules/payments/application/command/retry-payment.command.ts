import { Command } from '@nestjs/cqrs';
import type { PaymentView } from '../payment.view';
export class RetryPaymentCommand extends Command<PaymentView> {
  constructor(public readonly paymentId: string) {
    super();
  }
}
