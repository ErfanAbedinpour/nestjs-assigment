import { Command } from '@nestjs/cqrs';
export class ProcessPaymentCommand extends Command<void> {
  constructor(public readonly paymentId: string) {
    super();
  }
}
