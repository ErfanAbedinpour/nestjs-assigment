import { Command } from '@nestjs/cqrs';
export class RecoverStalledPaymentsCommand extends Command<number> {}
