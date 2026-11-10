import { Decimal } from 'decimal.js';
import Joi from 'joi';

const decimalUnitInterval = Joi.string()
  .pattern(/^\d+(?:\.\d+)?$/)
  .custom((value: string, helpers) => {
    const amount = new Decimal(value);
    if (amount.lt(0) || amount.gt(1)) return helpers.error('any.invalid');
    return value;
  });

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  APP_PORT: Joi.number().port().default(3000),
  APP_HOST_PORT: Joi.number().port().default(3000),

  POSTGRES_HOST: Joi.string().hostname().default('postgres'),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_HOST_PORT: Joi.number().port().default(5432),
  POSTGRES_DB: Joi.string().min(1).required(),
  POSTGRES_USER: Joi.string().min(1).required(),
  POSTGRES_PASSWORD: Joi.string().min(1).required(),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),

  RABBITMQ_HOST: Joi.string().hostname().default('rabbitmq'),
  RABBITMQ_PORT: Joi.number().port().default(5672),
  RABBITMQ_HOST_PORT: Joi.number().port().default(5672),
  RABBITMQ_USERNAME: Joi.string().min(1).required(),
  RABBITMQ_PASSWORD: Joi.string().min(1).required(),
  RABBITMQ_VHOST: Joi.string().default('/'),
  RABBITMQ_URL: Joi.string()
    .uri({ scheme: ['amqp', 'amqps'] })
    .allow('')
    .optional(),
  RABBITMQ_MANAGEMENT_PORT: Joi.number().port().default(15672),

  REDIS_HOST: Joi.string().hostname().default('redis'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_HOST_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  REDIS_URL: Joi.string()
    .uri({ scheme: ['redis', 'rediss'] })
    .allow('')
    .optional(),

  PAYMENT_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  PAYMENT_RETRY_BASE_DELAY_MS: Joi.number().integer().min(0).default(1000),
  PAYMENT_RETRY_MAX_DELAY_MS: Joi.number().integer().min(0).default(60_000),
  PAYMENT_RETRY_JITTER_RATIO: Joi.number().min(0).max(1).default(0.2),
  PAYMENT_PROCESSING_LEASE_MS: Joi.number().integer().min(1000).default(30_000),
  PAYMENT_DISPATCH_INTERVAL_MS: Joi.number().integer().min(100).default(1000),
  PAYMENT_DISPATCH_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(50),
  PAYMENT_RECOVERY_INTERVAL_MS: Joi.number().integer().min(100).default(5000),
  PAYMENT_RECOVERY_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(50),
  PAYMENT_QUEUED_STALE_MS: Joi.number().integer().min(1000).default(30_000),
  PAYMENT_FAILURE_PER_MINOR_UNIT: decimalUnitInterval.default('0.00001'),
  PAYMENT_MAX_FAILURE_PROBABILITY: decimalUnitInterval.default('0.8'),
  PAYMENT_FORCED_FAILURE_REFERENCES: Joi.string().allow('').default('FAIL'),
  IDEMPOTENCY_CACHE_TTL_MS: Joi.number().integer().min(0).default(86_400_000),
  PAYMENT_REQUEUE_DELAY_MS: Joi.number().integer().min(0).default(1000),
  PAYMENT_EXCHANGE: Joi.string().min(1).default('payments.exchange'),
  PAYMENT_QUEUE: Joi.string().min(1).default('payments.processing'),
  PAYMENT_ROUTING_KEY: Joi.string().min(1).default('payment.process'),
  PAYMENT_DLX: Joi.string().min(1).default('payments.dlx'),
  PAYMENT_DLQ: Joi.string().min(1).default('payments.processing.dlq'),
  PAYMENT_DELIVERY_LIMIT: Joi.number().integer().min(1).default(20),
  PAYMENT_PREFETCH: Joi.number().integer().min(1).max(500).default(10),
  PAYMENT_PUBLISH_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
  ADMIN_API_KEY: Joi.string().min(8).default('change_me'),
  ADMIN_REPORT_CACHE_TTL_MS: Joi.number().integer().min(0).default(30_000),
});
