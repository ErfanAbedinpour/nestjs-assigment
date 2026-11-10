import { applyDecorators } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ApiErrorDto } from '../../../shared/presentation/error.dto';
import { idempotencyKeyHeader } from '../../../shared/presentation/idempotency.docs';
import { SubmitPaymentBody } from './payment.schemas';
import { PaymentEventResponseDto, PaymentResponseDto } from './payment.responses';

const paymentId = ApiParam({ name: 'id', format: 'uuid', description: 'Payment id.' });

export function applyPaymentsController() {
  return applyDecorators(ApiTags('Payments'));
}

export function applySubmitPayment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Submit a payment',
      description:
        'Commits a PENDING payment and returns 202 even when the broker is down. The row is the outbox.',
    }),
    idempotencyKeyHeader,
    ApiBody({ type: SubmitPaymentBody }),
    ApiAcceptedResponse({ description: 'Payment accepted.', type: PaymentResponseDto }),
    ApiBadRequestResponse({
      description: 'VALIDATION_ERROR, INVALID_AMOUNT, or a missing idempotency key.',
      type: ApiErrorDto,
    }),
    ApiConflictResponse({ description: 'IDEMPOTENCY_KEY_REUSED.', type: ApiErrorDto }),
  );
}

export function applyGetPayment() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a payment' }),
    paymentId,
    ApiOkResponse({ description: 'Payment.', type: PaymentResponseDto }),
    ApiBadRequestResponse({ description: 'id is not a UUID v4.', type: ApiErrorDto }),
    ApiNotFoundResponse({ description: 'PAYMENT_NOT_FOUND.', type: ApiErrorDto }),
  );
}

export function applyPaymentEvents() {
  return applyDecorators(
    ApiOperation({ summary: 'List payment events' }),
    paymentId,
    ApiOkResponse({
      description: 'Status history, oldest first.',
      type: PaymentEventResponseDto,
      isArray: true,
    }),
    ApiBadRequestResponse({ description: 'id is not a UUID v4.', type: ApiErrorDto }),
    ApiNotFoundResponse({ description: 'PAYMENT_NOT_FOUND.', type: ApiErrorDto }),
  );
}

export function applyRetryPayment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Retry a failed payment',
      description:
        'Accepted for a technical failure, or for insufficient balance once the balance covers the amount.',
    }),
    paymentId,
    ApiOkResponse({ description: 'Payment queued again.', type: PaymentResponseDto }),
    ApiBadRequestResponse({ description: 'id is not a UUID v4.', type: ApiErrorDto }),
    ApiNotFoundResponse({ description: 'PAYMENT_NOT_FOUND.', type: ApiErrorDto }),
    ApiConflictResponse({
      description: 'PAYMENT_NOT_RETRYABLE or INVALID_PAYMENT_TRANSITION.',
      type: ApiErrorDto,
    }),
  );
}

export function applyCancelPayment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cancel a payment',
      description: 'Only PENDING and QUEUED payments can be cancelled.',
    }),
    paymentId,
    ApiOkResponse({ description: 'Payment cancelled.', type: PaymentResponseDto }),
    ApiBadRequestResponse({ description: 'id is not a UUID v4.', type: ApiErrorDto }),
    ApiNotFoundResponse({ description: 'PAYMENT_NOT_FOUND.', type: ApiErrorDto }),
    ApiConflictResponse({
      description: 'PAYMENT_NOT_CANCELLABLE.',
      type: ApiErrorDto,
    }),
  );
}
