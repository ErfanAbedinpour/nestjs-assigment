import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandBus } from '@nestjs/cqrs';
import { RecoverStalledPaymentsCommand } from '../../application/command/recover-stalled-payments.command';

@Injectable()
export class PaymentRecoveryPoller implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PaymentRecoveryPoller.name);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private running = false;

  constructor(
    private readonly commands: CommandBus,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
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
      await this.commands.execute(new RecoverStalledPaymentsCommand());
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
