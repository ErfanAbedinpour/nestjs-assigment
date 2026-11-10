import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RequestWithHeader = {
  header: (name: string) => string | undefined;
};

/**
 * Client-generated key that makes a financial write safe to retry.
 * The database unique constraint is the authority; this only rejects a malformed key early.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<RequestWithHeader>();
    const key = request.header('idempotency-key');
    if (typeof key !== 'string' || !UUID_V4.test(key)) {
      throw new BadRequestException('Idempotency-Key header must be a UUID v4');
    }
    return key;
  },
);
