import { ApiProperty } from '@nestjs/swagger';
import { minorUnitAmountApiProperty } from '../../../shared/presentation/amount.schema';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ ...minorUnitAmountApiProperty, example: '5000', description: 'Minor units.' })
  balance!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CreditResponseDto {
  @ApiProperty({ format: 'uuid' })
  transactionId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ enum: ['CREDIT'] })
  type!: 'CREDIT';

  @ApiProperty({ ...minorUnitAmountApiProperty, example: '1000' })
  amount!: string;

  @ApiProperty({ ...minorUnitAmountApiProperty, example: '6000' })
  balanceAfter!: string;

  @ApiProperty({ format: 'uuid' })
  idempotencyKey!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty()
  replayed!: boolean;
}
