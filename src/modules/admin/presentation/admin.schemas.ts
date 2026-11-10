import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import Joi from 'joi';

export class PageQuery {
  @ApiPropertyOptional({ type: 'integer', minimum: 1, default: 1 })
  page!: number;

  @ApiPropertyOptional({ type: 'integer', minimum: 1, maximum: 100, default: 20 })
  pageSize!: number;
}

export class SummaryQuery {
  @ApiProperty({ enum: ['daily', 'monthly', 'yearly'] })
  period!: 'daily' | 'monthly' | 'yearly';

  @ApiProperty({ format: 'date-time', type: String })
  from!: Date;

  @ApiProperty({ format: 'date-time', type: String })
  to!: Date;
}

export const pageQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
});

export const summaryQuerySchema = Joi.object({
  period: Joi.string().valid('daily', 'monthly', 'yearly').required(),
  from: Joi.date().iso().required(),
  to: Joi.date().iso().greater(Joi.ref('from')).required(),
});
