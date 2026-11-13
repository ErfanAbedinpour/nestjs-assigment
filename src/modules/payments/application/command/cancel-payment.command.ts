import { Command } from '@nestjs/cqrs';
import type { PaymentView } from '../payment.view';
export class CancelPaymentCommand extends Command<PaymentView> {
  constructor(public readonly paymentId: string) {
    super();
  }
}
