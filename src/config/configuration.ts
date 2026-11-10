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
  },
});
