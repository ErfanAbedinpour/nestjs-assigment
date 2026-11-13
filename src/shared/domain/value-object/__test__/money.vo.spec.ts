import { describe, expect, it } from 'vitest';
import { Money } from '../money.vo';

describe('Money', () => {
  it('preserves integer precision and supports arithmetic', () => {
    const amount = Money.ofMinorUnits('9007199254740993');
    expect(amount.add(Money.positive(2n)).toString()).toBe('9007199254740995');
    expect(amount.subtract(Money.positive('3')).toMinorUnits()).toBe(9007199254740990n);
    expect(amount.greaterThanOrEqual(amount)).toBe(true);
    expect(amount.equals(Money.ofMinorUnits('9007199254740993'))).toBe(true);
    expect(Money.zero().toDecimal().toString()).toBe('0');
  });

  it.each(['', '1.5', '1e3', '9223372036854775808', '-9223372036854775808'])(
    'rejects invalid stored amount %s',
    (value) => {
      expect(() => Money.ofMinorUnits(value)).toThrow();
    },
  );

  it.each(['0', '-1'])('requires positive amounts: %s', (value) => {
    expect(() => Money.positive(value)).toThrow('greater than zero');
  });
});
