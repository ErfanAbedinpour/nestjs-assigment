import { Decimal } from 'decimal.js';
import { DomainError } from './domain-error';

const INTEGER_PATTERN = /^-?\d+$/;
const MAX_STORED_MINOR_UNITS = new Decimal('9223372036854775807');

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_EVEN,
});

/**
 * Monetary amount kept as an integer number of minor units.
 * Every parse, sum, and comparison goes through decimal.js, so a value never
 * becomes a binary floating-point number on the way to PostgreSQL BIGINT.
 */
export class Money {
  private constructor(private readonly amount: Decimal) {}

  static ofMinorUnits(value: bigint | string): Money {
    return new Money(parseMinorUnits(value));
  }

  static positive(value: bigint | string): Money {
    const amount = parseMinorUnits(value);
    if (amount.lte(0)) {
      throw new DomainError('INVALID_AMOUNT', 'Amount must be greater than zero');
    }
    return new Money(amount);
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  add(other: Money): Money {
    return new Money(this.amount.plus(other.amount));
  }

  subtract(other: Money): Money {
    return new Money(this.amount.minus(other.amount));
  }

  greaterThanOrEqual(other: Money): boolean {
    return this.amount.gte(other.amount);
  }

  equals(other: Money): boolean {
    return this.amount.eq(other.amount);
  }

  toDecimal(): Decimal {
    return this.amount;
  }

  toMinorUnits(): bigint {
    return BigInt(this.amount.toFixed(0));
  }

  toString(): string {
    return this.amount.toFixed(0);
  }
}

function parseMinorUnits(value: bigint | string): Decimal {
  const text = typeof value === 'bigint' ? value.toString() : value.trim();
  if (!INTEGER_PATTERN.test(text)) {
    throw new DomainError('INVALID_AMOUNT', 'Amount must be an integer of minor units');
  }

  const amount = new Decimal(text);
  if (
    !amount.isFinite() ||
    !amount.isInteger() ||
    amount.abs().gt(MAX_STORED_MINOR_UNITS)
  ) {
    throw new DomainError('INVALID_AMOUNT', 'Amount must be an integer of minor units');
  }
  return amount;
}
