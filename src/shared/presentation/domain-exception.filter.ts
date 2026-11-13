import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { DomainError } from '../domain/error/domain.error';

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_AMOUNT: 400,
  INVALID_REPORT_RANGE: 400,
  USER_NOT_FOUND: 404,
  PAYMENT_NOT_FOUND: 404,
  USER_ALREADY_EXISTS: 409,
  IDEMPOTENCY_KEY_REUSED: 409,
  INSUFFICIENT_BALANCE: 422,
  INVALID_PAYMENT_TRANSITION: 409,
  PAYMENT_NOT_RETRYABLE: 409,
  PAYMENT_NOT_CANCELLABLE: 409,
};

type RequestWithId = { requestId?: string };

type JsonResponse = {
  status: (code: number) => { json: (body: unknown) => void };
};

/**
 * Maps business errors to stable HTTP contracts and hides unexpected failures.
 * Stack traces stay in the log; clients only receive a code, a message, and the request id.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<JsonResponse>();
    const requestId = http.getRequest<RequestWithId>().requestId ?? 'unknown';

    if (exception instanceof DomainError) {
      const status = STATUS_BY_CODE[exception.code] ?? 422;
      this.logger.warn(
        `domain_error code=${exception.code} status=${status} requestId=${requestId}`,
      );
      response.status(status).json({
        statusCode: status,
        code: exception.code,
        message: exception.message,
        ...(exception.details !== undefined ? { details: exception.details } : {}),
        requestId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = normalizeHttpMessage(body, exception.message);
      if (status >= 500) {
        this.logger.error(
          `http_error status=${status} requestId=${requestId}`,
          exception.stack,
        );
      } else {
        this.logger.warn(`http_error status=${status} requestId=${requestId}`);
      }
      response.status(status).json({
        statusCode: status,
        code: status === 400 ? 'VALIDATION_ERROR' : 'HTTP_ERROR',
        message,
        requestId,
      });
      return;
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(`unhandled_error requestId=${requestId}`, stack);
    response.status(500).json({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    });
  }
}

function normalizeHttpMessage(body: string | object, fallback: string): string {
  if (typeof body === 'string') return body;
  if (!('message' in body)) return fallback;
  const message = (body as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === 'string').join('; ');
  }
  return fallback;
}
