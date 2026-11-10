import { ApiProperty } from '@nestjs/swagger';
import { minorUnitAmountApiProperty } from '../../../shared/presentation/amount.schema';
import { UserResponseDto } from '../../users/presentation/user.responses';

export class AdminUserResponseDto extends UserResponseDto {}

export class AdminTransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['CREDIT', 'DEBIT'] })
  type!: string;

  @ApiProperty({ ...minorUnitAmountApiProperty, example: '1500' })
  amount!: string;

  @ApiProperty({ ...minorUnitAmountApiProperty, example: '3500' })
  balanceAfter!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  paymentId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  reference!: string | null;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  idempotencyKey!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class AdminUserPageDto {
  @ApiProperty({ type: [AdminUserResponseDto] })
  items!: AdminUserResponseDto[];

  @ApiProperty({ type: 'integer', minimum: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1 })
  pageSize!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  total!: number;
}

export class AdminTransactionPageDto {
  @ApiProperty({ type: [AdminTransactionResponseDto] })
  items!: AdminTransactionResponseDto[];

  @ApiProperty({ type: 'integer', minimum: 1 })
  page!: number;

  @ApiProperty({ type: 'integer', minimum: 1 })
  pageSize!: number;

  @ApiProperty({ type: 'integer', minimum: 0 })
  total!: number;
}

export class TransactionSummaryBucketDto {
  @ApiProperty({ format: 'date-time' })
  periodStart!: string;

  @ApiProperty()
  credits!: string;

  @ApiProperty()
  debits!: string;

  @ApiProperty()
  net!: string;
}

export class TransactionSummaryResponseDto {
  @ApiProperty({ enum: ['daily', 'monthly', 'yearly'] })
  period!: 'daily' | 'monthly' | 'yearly';

  @ApiProperty({ format: 'date-time' })
  from!: string;

  @ApiProperty({ format: 'date-time' })
  to!: string;

  @ApiProperty({ type: [TransactionSummaryBucketDto] })
  buckets!: TransactionSummaryBucketDto[];
}

export class BalanceUsageItemDto {
  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  balance!: string;

  @ApiProperty()
  totalCredits!: string;

  @ApiProperty()
  totalDebits!: string;
}

export class BalanceUsageResponseDto {
  @ApiProperty({ type: [BalanceUsageItemDto] })
  items!: BalanceUsageItemDto[];
}
