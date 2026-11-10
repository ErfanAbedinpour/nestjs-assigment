import { ApiProperty } from '@nestjs/swagger';
import Joi from 'joi';
import {
  minorUnitAmountApiProperty,
  minorUnitAmountSchema,
} from '../../../shared/presentation/amount.schema';

export class SubmitPaymentBody {
  @ApiProperty({ format: 'uuid', example: '11111111-1111-4111-8111-111111111111' })
  userId!: string;

  @ApiProperty(minorUnitAmountApiProperty)
  amount!: string;

  @ApiProperty({ minLength: 1, maxLength: 128, example: 'invoice-42' })
  reference!: string;

  @ApiProperty({ minLength: 1, maxLength: 500, example: 'Monthly subscription' })
  description!: string;
}

export const submitPaymentSchema = Joi.object({
  userId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  amount: minorUnitAmountSchema.required(),
  reference: Joi.string().trim().min(1).max(128).required(),
  description: Joi.string().trim().min(1).max(500).required(),
});
