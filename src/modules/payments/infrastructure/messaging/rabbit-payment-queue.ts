import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';
import {
  PaymentQueuePort,
  type PaymentQueueMessage,
} from '../../application/ports/payment-queue.port';
import { PAYMENT_RMQ_CLIENT, PAYMENT_PROCESS_PATTERN } from './payment-rmq.options';

@Injectable()
export class RabbitPaymentQueue extends PaymentQueuePort implements OnModuleDestroy {
  constructor(
    @Inject(PAYMENT_RMQ_CLIENT) private readonly client: ClientProxy,
    private readonly config: ConfigService,
  ) {
    super();
  }

  override async publish(message: PaymentQueueMessage): Promise<void> {
    const record = new RmqRecordBuilder(message)
      .setOptions({
        persistent: true,
        contentType: 'application/json',
        messageId: message.paymentId,
      })
      .build();
    await lastValueFrom(
      this.client
        .emit(PAYMENT_PROCESS_PATTERN, record)
        .pipe(timeout(this.config.getOrThrow<number>('payments.queue.publishTimeoutMs'))),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
