import type { Money } from '../../../../shared/domain/value-object/money.vo';

export type FailureSimulation =
  { kind: 'none' } | { kind: 'technical'; code: string; reason: string };

/**
 * Stand-in for an external gateway. Technical results are retryable;
 * insufficient balance is decided separately from the account itself.
 */
export abstract class PaymentFailureSimulator {
  abstract evaluate(input: { amount: Money; reference: string }): FailureSimulation;
}
