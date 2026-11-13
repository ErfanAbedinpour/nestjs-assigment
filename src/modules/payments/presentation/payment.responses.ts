import { ApiProperty } from '@nestjs/swagger';
import { minorUnitAmountApiProperty } from '../../../shared/presentation/amount.schema';
import { PaymentEventType, PaymentStatus } from '../domain/types/payment-status.types';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ ...minorUnitAmountApiProperty, example: '1200' })
  amount!: string;

  @ApiProperty()
  reference!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: Object.values(PaymentStatus) })
  status!: string;

  @ApiProperty({ type: 'integer' })
  attempts!: number;

  @ApiProperty({ type: String, nullable: true })
  failureCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  failureReason!: string | null;

  @ApiProperty({ format: 'uuid' })
  idempotencyKey!: string;

  @ApiProperty({ format: 'date-time' })
  nextDispatchAt!: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  queuedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  processingStartedAt!: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  completedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PaymentEventResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  paymentId!: string;

  @ApiProperty({ enum: Object.values(PaymentEventType) })
  type!: string;

  @ApiProperty({ type: 'integer' })
  attempt!: number;

  @ApiProperty({ type: String, nullable: true })
  fromStatus!: string | null;

  @ApiProperty()
  toStatus!: string;

  @ApiProperty({
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  metadata!: Record<string, string | number | boolean | null> | null;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;
}
