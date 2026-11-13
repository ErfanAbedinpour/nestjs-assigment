import { describe, expect, it } from 'vitest';
import { Money } from '../../../../../shared/domain/value-object/money.vo';
import { User } from '../user.aggregate';

describe('User account', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const create = () =>
    User.register({ id: 'u1', email: 'a@example.com', name: 'A', now });

  it('credits and debits while updating the balance and timestamp', () => {
    const user = create();
    const later = new Date('2026-01-02T00:00:00Z');
    expect(user.credit(Money.positive('100'), later).toString()).toBe('100');
    expect(user.debit(Money.positive('100'), later).toString()).toBe('0');
    expect(User.rehydrate(user.snapshot()).snapshot().updatedAt).toEqual(later);
  });

  it('rejects insufficient funds without changing state', () => {
    const user = create();
    const before = user.snapshot();
    expect(() => user.debit(Money.positive('1'), now)).toThrow('insufficient');
    expect(user.snapshot()).toEqual(before);
  });

  it.each(['credit', 'debit'] as const)('rejects nonpositive %s', (operation) => {
    const user = create();
    expect(() => user[operation](Money.zero(), now)).toThrow('greater than zero');
  });
});
