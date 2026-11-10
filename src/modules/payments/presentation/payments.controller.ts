import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Money } from '../../../shared/domain/money';
import { IdempotencyKey } from '../../../shared/presentation/idempotency-key.decorator';
import { CancelPayment } from '../application/cancel-payment';
import { GetPayment } from '../application/get-payment';
import { RetryPayment } from '../application/retry-payment';
import { SubmitPayment } from '../application/submit-payment';
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
    private readonly submitPayment: SubmitPayment,
    private readonly getPayment: GetPayment,
    private readonly retryPayment: RetryPayment,
    private readonly cancelPayment: CancelPayment,
  ) {}

  @applySubmitPayment()
  @Post()
  @HttpCode(202)
  submit(
    @IdempotencyKey() idempotencyKey: string,
    @Body({ schema: submitPaymentSchema }) body: SubmitPaymentBody,
  ): Promise<PaymentView> {
    return this.submitPayment.execute({
      userId: body.userId,
      amount: Money.positive(body.amount),
      reference: body.reference,
      description: body.description,
      idempotencyKey,
    });
  }

  @applyGetPayment()
  @Get(':id')
  get(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentView> {
    return this.getPayment.execute(id);
  }

  @applyPaymentEvents()
  @Get(':id/events')
  events(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentEventView[]> {
    return this.getPayment.events(id);
  }

  @applyRetryPayment()
  @Post(':id/retry')
  retry(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentView> {
    return this.retryPayment.execute(id);
  }

  @applyCancelPayment()
  @Post(':id/cancel')
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<PaymentView> {
    return this.cancelPayment.execute(id);
  }
}
