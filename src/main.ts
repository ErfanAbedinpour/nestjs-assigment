import { ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttpApp } from './shared/presentation/configure-http-app';
import { setupOpenApi } from './shared/presentation/openapi';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  configureHttpApp(app);
  setupOpenApi(app);

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('app.port');
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
