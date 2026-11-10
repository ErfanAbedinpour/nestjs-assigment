import Joi from 'joi';

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
});
