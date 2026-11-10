import { type INestApplication, StandardSchemaValidationPipe } from '@nestjs/common';
import { DomainExceptionFilter } from './domain-exception.filter';
import { requestContextMiddleware } from './request-context';

export function configureHttpApp(app: INestApplication): void {
  app.use(requestContextMiddleware);
  app.useGlobalPipes(new StandardSchemaValidationPipe({ transform: true }));
  app.useGlobalFilters(new DomainExceptionFilter());
  app.enableShutdownHooks();
}
