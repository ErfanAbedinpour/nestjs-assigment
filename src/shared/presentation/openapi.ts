import { type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { joiOpenApiConverter } from './joi-openapi';

export function setupOpenApi(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('User credit payments')
    .setDescription(
      'PostgreSQL is the source of truth for balances, payments, and the ledger. Amounts are integer minor units, sent as strings and calculated with decimal.js. RabbitMQ only wakes the worker.',
    )
    .setVersion('1.0.0')
    .addApiKey({ type: 'apiKey', name: 'X-Admin-Api-Key', in: 'header' }, 'admin-api-key')
    .addGlobalParameters({
      name: 'X-Request-Id',
      in: 'header',
      required: false,
      description:
        'Optional request id of letters, digits, and hyphens, up to 100 characters. The response echoes it.',
      schema: { type: 'string', maxLength: 100, pattern: '^[A-Za-z0-9-]{1,100}$' },
    })
    .build();

  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, config, {
      standardSchemaConverter: joiOpenApiConverter,
    }),
  );
}
