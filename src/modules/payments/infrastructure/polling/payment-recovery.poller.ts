import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecoverStalledPayments } from '../../application/recover-stalled-payments';

@Injectable()
export class PaymentRecoveryPoller implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentRecoveryPoller.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private running = false;

  constructor(
    private readonly recover: RecoverStalledPayments,
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
    const intervalMs = this.config.getOrThrow<number>('payments.recoveryIntervalMs');
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
      await this.recover.execute();
    } catch (error) {
      this.logger.error(
        'Payment recovery poll failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
      this.schedule();
    }
  }
}
