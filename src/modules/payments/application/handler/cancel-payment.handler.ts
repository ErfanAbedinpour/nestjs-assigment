import { Logger } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { CancelPaymentCommand } from '../command/cancel-payment.command';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import { Clock } from '../../../../shared/application/ports/clock';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { toPaymentView, type PaymentView } from '../payment.view';

@CommandHandler(CancelPaymentCommand)
export class CancelPaymentHandler {
  private readonly logger = new Logger(CancelPaymentHandler.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  async execute({ paymentId }: CancelPaymentCommand): Promise<PaymentView> {
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
