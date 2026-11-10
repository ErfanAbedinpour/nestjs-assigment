import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DispatchPendingPayments } from '../../application/dispatch-pending-payments';

@Injectable()
export class PaymentDispatchPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentDispatchPoller.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private running = false;

  constructor(
    private readonly dispatch: DispatchPendingPayments,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    void this.tick();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(): void {
    if (this.stopped) return;
    const intervalMs = this.config.getOrThrow<number>('payments.dispatchIntervalMs');
    this.timer = setTimeout(() => {
      void this.tick();
    }, intervalMs);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      this.schedule();
      return;
    }
    this.running = true;
    try {
      await this.dispatch.execute();
    } catch (error) {
      this.logger.error(
        'Payment dispatch poll failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
      this.schedule();
    }
  }
}
