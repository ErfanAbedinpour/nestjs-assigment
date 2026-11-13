import { Logger } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import { SubmitPaymentCommand } from '../command/submit-payment.command';
import { ConfigService } from '@nestjs/config';
import { DomainError } from '../../../../shared/domain/error/domain.error';
import { CachePort } from '../../../../shared/application/ports/cache-port';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { UniqueConstraintError } from '../../../../shared/application/unique-constraint.error';
import { UnitOfWork } from '../../../../shared/application/ports/unit-of-work';
import { Payment } from '../../domain/aggregation/payment.aggregate';
import { PaymentRepository } from '../../domain/repository/payment.repository';
import { PaymentStatus } from '../../domain/types/payment-status.types';
import { AccountLookupPort } from '../ports/account-ports';
import { CommandBus } from '@nestjs/cqrs';
import { DispatchPendingPaymentsCommand } from '../command/dispatch-pending-payments.command';
import { paymentFingerprint } from '../payment-fingerprint';
import { toPaymentView, type PaymentView } from '../payment.view';

@CommandHandler(SubmitPaymentCommand)
export class SubmitPaymentHandler {
  private readonly logger = new Logger(SubmitPaymentHandler.name);

  constructor(
    private readonly payments: PaymentRepository,
    private readonly accounts: AccountLookupPort,
    private readonly unitOfWork: UnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly cache: CachePort,
    private readonly commands: CommandBus,
    private readonly config: ConfigService,
  ) {}

  async execute({ input: command }: SubmitPaymentCommand): Promise<PaymentView> {
    const fingerprint = paymentFingerprint({
      userId: command.userId,
      amount: command.amount.toString(),
      reference: command.reference,
      description: command.description,
    });
    const cachedId = await this.cachedPaymentId(command.userId, command.idempotencyKey);
    if (cachedId !== undefined) {
      const cached = await this.payments.findById(cachedId);
      if (cached) return this.finishReplay(cached, fingerprint);
    }

    if (!(await this.accounts.exists(command.userId))) {
      throw new DomainError('USER_NOT_FOUND', 'User was not found');
    }

    const payment = Payment.submit({
      id: this.ids.next(),
      userId: command.userId,
      amount: command.amount,
      reference: command.reference,
      description: command.description,
      idempotencyKey: command.idempotencyKey,
      requestFingerprint: fingerprint,
      now: this.clock.now(),
    });

    try {
      await this.unitOfWork.run(() => this.payments.insert(payment));
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) throw error;
      const existing = await this.payments.findByIdempotencyKey(
        command.userId,
        command.idempotencyKey,
      );
      if (!existing) throw error;
      return this.finishReplay(existing, fingerprint);
    }

    await this.remember(command.userId, command.idempotencyKey, payment.snapshot().id);
    this.logger.log(`payment.created paymentId=${payment.snapshot().id}`);
    await this.tryDispatch(payment.snapshot().id);
    return this.reload(payment);
  }

  private async finishReplay(
    payment: Payment,
    fingerprint: string,
  ): Promise<PaymentView> {
    const snapshot = payment.snapshot();
    if (snapshot.requestFingerprint !== fingerprint) {
      throw new DomainError(
        'IDEMPOTENCY_KEY_REUSED',
        'Idempotency-Key was already used for a different payment',
      );
    }
    if (
      snapshot.status === PaymentStatus.Pending &&
      snapshot.nextDispatchAt.getTime() <= this.clock.now().getTime()
    ) {
      await this.tryDispatch(snapshot.id);
      return this.reload(payment);
    }
    return toPaymentView(payment);
  }

  private async reload(payment: Payment): Promise<PaymentView> {
    const current = await this.payments.findById(payment.snapshot().id);
    return toPaymentView(current ?? payment);
  }

  /**
   * The payment row is already committed, so a broker outage does not fail the
   * request. The dispatch poller publishes anything left PENDING.
   */
  private async tryDispatch(paymentId: string): Promise<void> {
    try {
      await this.commands.execute(new DispatchPendingPaymentsCommand(paymentId));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown dispatch failure';
      this.logger.warn(
        `payment.dispatch_fast_path_failed paymentId=${paymentId} reason=${reason}`,
      );
    }
  }

  private cacheKey(userId: string, idempotencyKey: string): string {
    return `idempotency:payment:${userId}:${idempotencyKey}`;
  }

  private async cachedPaymentId(
    userId: string,
    idempotencyKey: string,
  ): Promise<string | undefined> {
    const cached = await this.cache.get<{ paymentId?: unknown }>(
      this.cacheKey(userId, idempotencyKey),
    );
    return typeof cached?.paymentId === 'string' ? cached.paymentId : undefined;
  }

  private async remember(
    userId: string,
    idempotencyKey: string,
    paymentId: string,
  ): Promise<void> {
    const ttl = this.config.getOrThrow<number>('payments.idempotencyCacheTtlMs');
    await this.cache.set(this.cacheKey(userId, idempotencyKey), { paymentId }, ttl);
  }
}
