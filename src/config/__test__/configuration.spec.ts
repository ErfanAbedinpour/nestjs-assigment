import { afterEach, describe, expect, it, vi } from 'vitest';
import { configuration } from '../configuration';
import { validationSchema } from '../validation.schema';

describe('configuration', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('builds service URLs with escaped credentials and trims forced patterns', () => {
    vi.stubEnv('REDIS_URL', '');
    vi.stubEnv('REDIS_PASSWORD', 'a@b');
    vi.stubEnv('RABBITMQ_URL', '');
    vi.stubEnv('RABBITMQ_USERNAME', 'a@b');
    vi.stubEnv('RABBITMQ_PASSWORD', 'p/q');
    vi.stubEnv('PAYMENT_FORCED_FAILURE_REFERENCES', ' FAIL, ,error ');
    const config = configuration();
    expect(config.redis.url).toContain(':a%40b@');
    expect(config.rabbitmq.url).toContain('a%40b:p%2Fq@');
    expect(config.payments.forcedReferencePatterns).toEqual(['FAIL', 'error']);
  });

  it('uses explicit service URLs and permits disabling forced failures', () => {
    vi.stubEnv('REDIS_URL', 'redis://example:6379');
    vi.stubEnv('RABBITMQ_URL', 'amqp://example');
    vi.stubEnv('PAYMENT_FORCED_FAILURE_REFERENCES', '');
    expect(configuration()).toMatchObject({
      redis: { url: 'redis://example:6379' },
      rabbitmq: { url: 'amqp://example' },
      payments: { forcedReferencePatterns: [] },
    });
  });

  it('applies defaults and rejects invalid probability and retry settings', () => {
    const required = {
      POSTGRES_DB: 'db',
      POSTGRES_USER: 'user',
      POSTGRES_PASSWORD: 'password',
      DATABASE_URL: 'postgresql://localhost/db',
      RABBITMQ_USERNAME: 'user',
      RABBITMQ_PASSWORD: 'password',
    };
    const result = validationSchema.validate(required);
    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      PAYMENT_MAX_ATTEMPTS: 5,
      PAYMENT_FAILURE_PER_MINOR_UNIT: '0',
    });
    expect(
      validationSchema.validate({ ...required, PAYMENT_MAX_ATTEMPTS: 0 }).error,
    ).toBeDefined();
    expect(
      validationSchema.validate({ ...required, PAYMENT_MAX_FAILURE_PROBABILITY: '1.1' })
        .error,
    ).toBeDefined();
  });
});
