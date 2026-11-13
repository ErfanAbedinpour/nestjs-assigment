import { Decimal } from 'decimal.js';
import { RandomSource } from '../../../../shared/application/ports/random-source';
import { FailureCode } from '../../domain/types/payment-status.types';
import {
  PaymentFailureSimulator,
  type FailureSimulation,
} from '../../application/ports/failure-simulator.port';
import { Money } from '../../../../shared/domain/value-object/money.vo';

const PROBABILITY_SCALE = 1_000_000;

/**
 * Test double for an external gateway. Larger amounts fail more often, and a
 * reference containing a configured token always fails. Both results are
 * technical so the retry policy can be observed; insufficient balance is not
 * decided here.
 *
 * The chance is `amount * rate`, computed with decimal.js. Multiplying the
 * minor-unit count by a binary float would make the threshold depend on IEEE-754 rounding.
 */
export class AmountBasedFailureSimulator extends PaymentFailureSimulator {
  private readonly failurePerMinorUnit: Decimal;
  private readonly maxFailureProbability: Decimal;

  constructor(
    failurePerMinorUnit: string,
    maxFailureProbability: string,
    private readonly forcedReferencePatterns: readonly string[],
    private readonly random: RandomSource,
  ) {
    super();
    this.failurePerMinorUnit = new Decimal(failurePerMinorUnit);
    this.maxFailureProbability = new Decimal(maxFailureProbability);
  }

  override evaluate(input: { amount: Money; reference: string }): FailureSimulation {
    const pattern = this.matchingPattern(input.reference);
    if (pattern !== undefined) {
      return {
        kind: 'technical',
        code: FailureCode.Simulated,
        reason: `Simulated technical failure (reference matches ${pattern})`,
      };
    }

    const probability = Decimal.min(
      this.maxFailureProbability,
      input.amount.toDecimal().mul(this.failurePerMinorUnit),
    );
    const roll = new Decimal(this.random.nextInt(PROBABILITY_SCALE)).div(
      PROBABILITY_SCALE,
    );
    if (probability.gt(0) && roll.lt(probability)) {
      return {
        kind: 'technical',
        code: FailureCode.Simulated,
        reason: 'Simulated technical failure (amount-based probability)',
      };
    }
    return { kind: 'none' };
  }

  private matchingPattern(reference: string): string | undefined {
    const normalized = reference.toUpperCase();
    return this.forcedReferencePatterns.find((pattern) =>
      normalized.includes(pattern.toUpperCase()),
    );
  }
}
