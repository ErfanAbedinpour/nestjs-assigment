import { Logger } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { DispatchPendingPaymentsCommand } from '../command/dispatch-pending-payments.command';
import { ConfigService } from '@nestjs/config';
import { Clock } from '../../../../shared/application/ports/clock';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { Payment } from '../../domain/aggregation/payment.aggregate';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { PaymentStatus } from '../../domain/types/payment-status.types';
import { PaymentQueuePort } from '../ports/payment-queue.port';

@CommandHandler(DispatchPendingPaymentsCommand)
export class DispatchPendingPaymentsHandler {
  private readonly logger = new Logger(DispatchPendingPaymentsHandler.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly queue: PaymentQueuePort,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {}

  private async dispatchById(paymentId: string): Promise<void> {
    await this.unitOfWork.run(async () => {
      const payment = await this.payments.lockById(paymentId);
      if (!payment) return;
      const snapshot = payment.snapshot();
      if (snapshot.status !== PaymentStatus.Pending) return;
      if (snapshot.nextDispatchAt.getTime() > this.clock.now().getTime()) return;
      await this.publishAndMarkQueued(payment);
    });
  }

  /**
   * Locks a batch, confirms each publish, then marks the row QUEUED in the same
   * transaction. A crash after the broker confirm and before commit leaves a
   * duplicate message, which the worker ignores unless the row is still QUEUED.
   */
  async execute(command: DispatchPendingPaymentsCommand): Promise<number | void> {
    if (command.paymentId !== undefined) return this.dispatchById(command.paymentId);
    const batchSize = this.config.getOrThrow<number>('payments.dispatchBatchSize');
    return this.unitOfWork.run(async () => {
      const due = await this.payments.lockDueForDispatch(batchSize);
      for (const payment of due) {
        await this.publishAndMarkQueued(payment);
      }
      return due.length;
    });
  }

  private async publishAndMarkQueued(payment: Payment): Promise<void> {
    const paymentId = payment.snapshot().id;
    await this.queue.publish({ paymentId });
    payment.markQueued(this.clock.now());
    await this.payments.save(payment);
    this.logger.log(`payment.queued paymentId=${paymentId}`);
  }
}
