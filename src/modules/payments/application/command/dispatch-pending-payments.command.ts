import { Command } from '@nestjs/cqrs';
export class DispatchPendingPaymentsCommand extends Command<number | void> {
  constructor(public readonly paymentId?: string) {
    super();
  }
}
