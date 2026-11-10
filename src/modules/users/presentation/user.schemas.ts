import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';
import {
  minorUnitAmountApiProperty,
  minorUnitAmountSchema,
} from '../../../shared/presentation/amount.schema';

export class RegisterUserBody {
  @ApiProperty({ format: 'email', maxLength: 254, example: 'ada@example.com' })
  email!: string;

  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Ada Lovelace' })
  name!: string;

  @ApiPropertyOptional(minorUnitAmountApiProperty)
  initialBalance?: string;
}

export class CreditUserBody {
  @ApiProperty(minorUnitAmountApiProperty)
  amount!: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 128, example: 'top-up' })
  reference?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 500, example: 'Wallet credit' })
  description?: string;
}

export const registerUserSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().max(254).required(),
  name: Joi.string().trim().min(1).max(120).required(),
  initialBalance: minorUnitAmountSchema.optional(),
});

export const creditUserSchema = Joi.object({
  amount: minorUnitAmountSchema.required(),
  reference: Joi.string().trim().min(1).max(128).optional(),
  description: Joi.string().trim().min(1).max(500).optional(),
});
