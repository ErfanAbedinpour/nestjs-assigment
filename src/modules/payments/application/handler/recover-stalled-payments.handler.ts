import { Logger } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { RecoverStalledPaymentsCommand } from '../command/recover-stalled-payments.command';
import { ConfigService } from '@nestjs/config';
import { Clock } from '../../../../shared/application/ports/clock';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { FailureCode, PaymentStatus } from '../../domain/types/payment-status.types';
import { RetryPolicy } from '../../domain/policy/retry.policy';

/**
 * Repairs payments whose worker died or whose queue message was lost.
 * PostgreSQL `FOR UPDATE` rechecks the stale predicate, so a settlement that
 * commits while this query waits is not recovered out from under itself.
 */
@CommandHandler(RecoverStalledPaymentsCommand)
export class RecoverStalledPaymentsHandler {
  private readonly logger = new Logger(RecoverStalledPaymentsHandler.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly retryPolicy: RetryPolicy,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly config: ConfigService,
  ) {}

  async execute(_command: RecoverStalledPaymentsCommand): Promise<number> {
    const leaseMs = this.config.getOrThrow<number>('payments.leaseMs');
    const queuedStaleMs = this.config.getOrThrow<number>('payments.queuedStaleMs');
    const limit = this.config.getOrThrow<number>('payments.recoveryBatchSize');

    return this.unitOfWork.run(async () => {
      const stalled = await this.payments.lockStalled({ leaseMs, queuedStaleMs, limit });
      const now = this.clock.now();
      let recovered = 0;

      for (const payment of stalled) {
        const status = payment.snapshot().status;
        if (status === PaymentStatus.Processing) {
          const decision = this.retryPolicy.decide(payment.snapshot().attempts);
          payment.failTechnical({
            now,
            code: FailureCode.Technical,
            reason: 'Processing lease expired before the attempt was settled',
            decision,
            source: 'reconciler',
          });
        } else if (status === PaymentStatus.Queued) {
          payment.requeueLostMessage(now);
        } else {
          continue;
        }
        await this.payments.save(payment);
        recovered += 1;
        this.logger.warn(
          `payment.recovered paymentId=${payment.snapshot().id} from=${status}`,
        );
      }

      return recovered;
    });
  }
}
