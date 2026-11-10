import Joi from 'joi';

/**
 * Positive integer minor units as a string.
 * A JSON number is rejected: values such as 0.1 and integers past 2^53 are not exact in IEEE-754.
 */
export const minorUnitAmountDescription =
  'Positive integer count of minor units, as a string. JSON numbers are rejected so the value never passes through binary floating point.';

export const minorUnitAmountApiProperty = {
  type: 'string' as const,
  pattern: '^[1-9]\\d{0,17}$',
  example: '1500',
  description: minorUnitAmountDescription,
};

export const minorUnitAmountSchema = Joi.string()
  .pattern(/^[1-9]\d{0,17}$/)
  .description(minorUnitAmountDescription)
  .example('1500');
