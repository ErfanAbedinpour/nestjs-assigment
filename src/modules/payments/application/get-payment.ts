import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../shared/domain/domain-error';
import { PaymentRepository } from '../domain/payment.repository';
import {
  toPaymentEventView,
  toPaymentView,
  type PaymentEventView,
  type PaymentView,
} from './payment.view';

@Injectable()
export class GetPayment {
  constructor(private readonly payments: PaymentRepository) {}

  async execute(paymentId: string): Promise<PaymentView> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment was not found');
    return toPaymentView(payment);
  }

  async events(paymentId: string): Promise<PaymentEventView[]> {
    const payment = await this.payments.findById(paymentId);
    if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment was not found');
    const events = await this.payments.listEvents(paymentId);
    return events.map(toPaymentEventView);
  }
}
