import { describe, expect, it, vi } from 'vitest';
import { Money } from '../../../../../shared/domain/value-object/money.vo';
import { AmountBasedFailureSimulator } from '../amount-failure-simulator';

describe('AmountBasedFailureSimulator', () => {
  it('forces failures for configured reference tokens regardless of case', () => {
    const nextInt = vi.fn();
    const simulator = new AmountBasedFailureSimulator('0', '0.8', ['FAIL'], { nextInt });
    expect(
      simulator.evaluate({ amount: Money.positive('1'), reference: 'test-fail' }),
    ).toMatchObject({ kind: 'technical', code: 'SIMULATED_FAILURE' });
    expect(nextInt).not.toHaveBeenCalled();
  });

  it('respects the configured probability cap and threshold', () => {
    const nextInt = vi.fn().mockReturnValueOnce(799999).mockReturnValueOnce(800000);
    const simulator = new AmountBasedFailureSimulator('0.01', '0.8', [], { nextInt });
    expect(
      simulator.evaluate({ amount: Money.positive('1000'), reference: 'r' }).kind,
    ).toBe('technical');
    expect(
      simulator.evaluate({ amount: Money.positive('1000'), reference: 'r' }).kind,
    ).toBe('none');
    expect(nextInt).toHaveBeenCalledWith(1000000);
  });

  it('does not randomly fail when the rate is zero', () => {
    const simulator = new AmountBasedFailureSimulator('0', '0.8', [], {
      nextInt: () => 0,
    });
    expect(simulator.evaluate({ amount: Money.positive('100'), reference: 'r' })).toEqual(
      { kind: 'none' },
    );
  });
});
