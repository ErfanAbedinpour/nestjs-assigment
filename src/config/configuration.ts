function redisUrl(): string {
  if (process.env['REDIS_URL']) return process.env['REDIS_URL'];

  const host = process.env['REDIS_HOST'] ?? 'redis';
  const port = process.env['REDIS_PORT'] ?? '6379';
  const password = process.env['REDIS_PASSWORD'] ?? '';
  const database = process.env['REDIS_DB'] ?? '0';
  const credentials = password ? `:${encodeURIComponent(password)}@` : '';

  return `redis://${credentials}${host}:${port}/${database}`;
}

function rabbitMqUrl(): string {
  if (process.env['RABBITMQ_URL']) return process.env['RABBITMQ_URL'];

  const host = process.env['RABBITMQ_HOST'] ?? 'rabbitmq';
  const port = process.env['RABBITMQ_PORT'] ?? '5672';
  const username = encodeURIComponent(process.env['RABBITMQ_USERNAME'] ?? 'app_user');
  const password = encodeURIComponent(process.env['RABBITMQ_PASSWORD'] ?? '');
  const virtualHost = encodeURIComponent(process.env['RABBITMQ_VHOST'] ?? '/');

  return `amqp://${username}:${password}@${host}:${port}/${virtualHost}`;
}

function forcedFailurePatterns(): string[] {
  const raw = process.env['PAYMENT_FORCED_FAILURE_REFERENCES'];
  const source = raw === undefined ? 'FAIL' : raw;
  return source
    .split(',')
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
}

export const configuration = () => ({
  app: {
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    port: Number(process.env['APP_PORT'] ?? 3000),
  },
  database: {
    url: process.env['DATABASE_URL'],
  },
  rabbitmq: {
    url: rabbitMqUrl(),
    host: process.env['RABBITMQ_HOST'] ?? 'rabbitmq',
    port: Number(process.env['RABBITMQ_PORT'] ?? 5672),
    username: process.env['RABBITMQ_USERNAME'],
    password: process.env['RABBITMQ_PASSWORD'],
    vhost: process.env['RABBITMQ_VHOST'] ?? '/',
  },
  redis: {
    url: redisUrl(),
    host: process.env['REDIS_HOST'] ?? 'redis',
    port: Number(process.env['REDIS_PORT'] ?? 6379),
    password: process.env['REDIS_PASSWORD'] ?? '',
    database: Number(process.env['REDIS_DB'] ?? 0),
    connectionTimeoutMs: Number(process.env['REDIS_CONNECTION_TIMEOUT_MS'] ?? 1000),
  },
  payments: {
    retry: {
      maxAttempts: Number(process.env['PAYMENT_MAX_ATTEMPTS'] ?? 5),
      baseDelayMs: Number(process.env['PAYMENT_RETRY_BASE_DELAY_MS'] ?? 1000),
      maxDelayMs: Number(process.env['PAYMENT_RETRY_MAX_DELAY_MS'] ?? 60000),
      jitterRatio: Number(process.env['PAYMENT_RETRY_JITTER_RATIO'] ?? 0.2),
    },
    leaseMs: Number(process.env['PAYMENT_PROCESSING_LEASE_MS'] ?? 30000),
    dispatchIntervalMs: Number(process.env['PAYMENT_DISPATCH_INTERVAL_MS'] ?? 1000),
    dispatchBatchSize: Number(process.env['PAYMENT_DISPATCH_BATCH_SIZE'] ?? 50),
    recoveryIntervalMs: Number(process.env['PAYMENT_RECOVERY_INTERVAL_MS'] ?? 5000),
    recoveryBatchSize: Number(process.env['PAYMENT_RECOVERY_BATCH_SIZE'] ?? 50),
    queuedStaleMs: Number(process.env['PAYMENT_QUEUED_STALE_MS'] ?? 30000),
    failurePerMinorUnit: process.env['PAYMENT_FAILURE_PER_MINOR_UNIT'] ?? '0',
    maxFailureProbability: process.env['PAYMENT_MAX_FAILURE_PROBABILITY'] ?? '0.8',
    forcedReferencePatterns: forcedFailurePatterns(),
    idempotencyCacheTtlMs: Number(process.env['IDEMPOTENCY_CACHE_TTL_MS'] ?? 86400000),
    requeueDelayMs: Number(process.env['PAYMENT_REQUEUE_DELAY_MS'] ?? 1000),
    queue: {
      exchange: process.env['PAYMENT_EXCHANGE'] ?? 'payments.exchange',
      queue: process.env['PAYMENT_QUEUE'] ?? 'payments.processing',
      routingKey: process.env['PAYMENT_ROUTING_KEY'] ?? 'payment.process',
      deadLetterExchange: process.env['PAYMENT_DLX'] ?? 'payments.dlx',
      deadLetterQueue: process.env['PAYMENT_DLQ'] ?? 'payments.processing.dlq',
      deliveryLimit: Number(process.env['PAYMENT_DELIVERY_LIMIT'] ?? 20),
      prefetch: Number(process.env['PAYMENT_PREFETCH'] ?? 10),
      publishTimeoutMs: Number(process.env['PAYMENT_PUBLISH_TIMEOUT_MS'] ?? 5000),
    },
  },
  admin: {
    apiKey: process.env['ADMIN_API_KEY'] ?? 'change_me',
    reportCacheTtlMs: Number(process.env['ADMIN_REPORT_CACHE_TTL_MS'] ?? 30000),
  },
});
