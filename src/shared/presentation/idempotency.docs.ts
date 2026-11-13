import { ApiHeader } from '@nestjs/swagger';

export const idempotencyKeyHeader = ApiHeader({
  name: 'Idempotency-Key',
  required: true,
  description:
    'UUID v4. Use a new key for each new write. The same key and body replay the original write; a different body returns 409.',
  schema: {
    type: 'string',
    format: 'uuid',
    default: '550e8400-e29b-41d4-a716-446655440000',
    example: '550e8400-e29b-41d4-a716-446655440000',
  },
});
