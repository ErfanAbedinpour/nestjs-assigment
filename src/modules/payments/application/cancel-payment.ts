import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../shared/domain/domain-error';
import { Clock } from '../../../shared/application/ports/clock';
import { UnitOfWork } from '../../../shared/application/ports/unit-of-work';
import { PaymentRepository } from '../domain/payment.repository';
import { toPaymentView, type PaymentView } from './payment.view';

@Injectable()
export class CancelPayment {
  private readonly logger = new Logger(CancelPayment.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute(paymentId: string): Promise<PaymentView> {
    return this.unitOfWork.run(async () => {
      const payment = await this.payments.lockById(paymentId);
      if (!payment) throw new DomainError('PAYMENT_NOT_FOUND', 'Payment was not found');
      payment.cancel(this.clock.now());
      await this.payments.save(payment);
      this.logger.log(`payment.cancelled paymentId=${paymentId}`);
      return toPaymentView(payment);
    });
  }
}
