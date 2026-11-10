import { ApiHeader } from '@nestjs/swagger';

export const idempotencyKeyHeader = ApiHeader({
  name: 'Idempotency-Key',
  required: true,
  description:
    'UUID v4. The same key and body replay the original write. The same key with a different body returns 409.',
  schema: { type: 'string', format: 'uuid' },
});
