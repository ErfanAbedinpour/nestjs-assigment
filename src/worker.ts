import { ConfigService } from '@nestjs/config';
import { type MicroserviceOptions } from '@nestjs/microservices';
import { PaymentQueueTopology } from './modules/payments/infrastructure/messaging/payment-queue.topology';
import {
  paymentRmqOptions,
  PaymentMessageDeserializer,
} from './modules/payments/infrastructure/messaging/payment-rmq.options';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(WorkerModule, {
    logger: new ConsoleLogger({ json: true, colors: false }),
  });
  app.enableShutdownHooks();
  const options = paymentRmqOptions(
    app.get(ConfigService),
    app.get(PaymentQueueTopology),
  );
  app.connectMicroservice<MicroserviceOptions>({
    ...options,
    options: {
      ...options.options,
      noAck: false,
      deserializer: new PaymentMessageDeserializer(),
    },
  });
  await app.init();
  await app.startAllMicroservices();
}

void bootstrap();
