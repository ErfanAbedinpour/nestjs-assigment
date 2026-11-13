import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CancelPaymentCommand } from '../application/command/cancel-payment.command';
import { RetryPaymentCommand } from '../application/command/retry-payment.command';
import { SubmitPaymentCommand } from '../application/command/submit-payment.command';
import { GetPaymentQuery } from '../application/query/get-payment.query';
import { GetPaymentEventsQuery } from '../application/query/get-payment-events.query';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Money } from '../../../shared/domain/value-object/money.vo';
import { IdempotencyKey } from '../../../shared/presentation/idempotency-key.decorator';
import type { PaymentEventView, PaymentView } from '../application/payment.view';
import { SubmitPaymentBody, submitPaymentSchema } from './payment.schemas';
import {
  applyCancelPayment,
  applyGetPayment,
  applyPaymentEvents,
  applyPaymentsController,
  applyRetryPayment,
  applySubmitPayment,
} from './payments.api';

@applyPaymentsController()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @applySubmitPayment()
  @Post()
  @HttpCode(202)
  submit(
    @IdempotencyKey() idempotencyKey: string,
    @Body({ schema: submitPaymentSchema }) body: SubmitPaymentBody,
  ): Promise<PaymentView> {
    return this.commands.execute(
      new SubmitPaymentCommand({
        userId: body.userId,
        amount: Money.positive(body.amount),
        reference: body.reference,
        description: body.description,
        idempotencyKey,
      }),
    );
  }

  @applyGetPayment()
  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentView> {
    return this.queries.execute(new GetPaymentQuery(id));
  }

  @applyPaymentEvents()
  @Get(':id/events')
  events(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentEventView[]> {
    return this.queries.execute(new GetPaymentEventsQuery(id));
  }

  @applyRetryPayment()
  @Post(':id/retry')
  retry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentView> {
    return this.commands.execute(new RetryPaymentCommand(id));
  }

  @applyCancelPayment()
  @Post(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentView> {
    return this.commands.execute(new CancelPaymentCommand(id));
  }
}
