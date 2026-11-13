import { QueryHandler } from '@nestjs/cqrs';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { toPaymentView, type PaymentView } from '../payment.view';
import { GetPaymentQuery } from '../query/get-payment.query';
@QueryHandler(GetPaymentQuery)
export class GetPaymentHandler {
  constructor(private readonly payments: PaymentRepository) {}
  async execute({ paymentId }: GetPaymentQuery): Promise<PaymentView> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment was not found');
    return toPaymentView(payment);
  }
}
