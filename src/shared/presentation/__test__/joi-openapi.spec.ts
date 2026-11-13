import Joi from 'joi';
import { describe, expect, it } from 'vitest';
import { joiOpenApiConverter } from '../joi-openapi';

describe('Joi OpenAPI converter', () => {
  it('converts object properties, constraints, required fields and annotations', () => {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      count: Joi.number().integer().min(1).max(10).default(2),
      name: Joi.string().min(2).max(20).description('Name').example('Ada'),
      date: Joi.date(),
      state: Joi.string().valid('one', 'two'),
      code: Joi.string().pattern(/^[A-Z]+$/),
    });
    const converted = joiOpenApiConverter(schema as never);
    expect(converted?.schema).toMatchObject({
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
        count: { type: 'integer', minimum: 1, maximum: 10, default: 2 },
        name: { minLength: 2, maxLength: 20, description: 'Name', example: 'Ada' },
        date: { format: 'date-time' },
        state: { enum: ['one', 'two'] },
        code: { pattern: '^[A-Z]+$' },
      },
    });
  });

  it('ignores schemas from other vendors', () => {
    expect(joiOpenApiConverter({} as never)).toBeUndefined();
    expect(joiOpenApiConverter(null as never)).toBeUndefined();
    expect(joiOpenApiConverter({ describe: () => ({}) } as never)).toBeUndefined();
    expect(
      joiOpenApiConverter({
        describe: () => ({}),
        '~standard': { vendor: 'other' },
      } as never),
    ).toBeUndefined();
  });

  it('converts UUID, decimal and schemas without object properties', () => {
    const result = joiOpenApiConverter(
      Joi.object({ id: Joi.string().guid(), rate: Joi.number().min(0).max(1) }) as never,
    );
    expect(result?.schema).toMatchObject({
      properties: {
        id: { format: 'uuid' },
        rate: { type: 'number', minimum: 0, maximum: 1 },
      },
    });
    const empty = {
      '~standard': { vendor: 'joi' },
      describe: () => ({ type: 'object' }),
    };
    expect(joiOpenApiConverter(empty as never)?.schema).toEqual({
      type: 'object',
      properties: {},
    });
  });
});
