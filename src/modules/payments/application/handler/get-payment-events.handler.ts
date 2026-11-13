import { QueryHandler } from '@nestjs/cqrs';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { toPaymentEventView, type PaymentEventView } from '../payment.view';
import { GetPaymentEventsQuery } from '../query/get-payment-events.query';
@QueryHandler(GetPaymentEventsQuery)
export class GetPaymentEventsHandler {
  constructor(private readonly payments: PaymentRepository) {}
  async execute({ paymentId }: GetPaymentEventsQuery): Promise<PaymentEventView[]> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment was not found');
    const events = await this.payments.listEvents(paymentId);
    return events.map(toPaymentEventView);
  }
}
