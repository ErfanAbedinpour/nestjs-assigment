import { Command } from '@nestjs/cqrs';
import type { Money } from '../../../../shared/domain/value-object/money.vo';
import type { PaymentView } from '../payment.view';
export type SubmitPaymentInput = {
  userId: string;
  amount: Money;
  reference: string;
  description: string;
  idempotencyKey: string;
};
export class SubmitPaymentCommand extends Command<PaymentView> {
  constructor(public readonly input: SubmitPaymentInput) {
    super();
  }
}
