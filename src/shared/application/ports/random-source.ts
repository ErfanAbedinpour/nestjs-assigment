/** Source of randomness. Integer draws stay exact so callers can scale them with decimal.js. */
export abstract class RandomSource {
  /** Half-open interval [0, 1). Suitable for jitter, not for money. */
  abstract nextUnitInterval(): number;

  /** Integer in the half-open range [0, exclusiveUpper). */
  abstract nextInt(exclusiveUpper: number): number;
}
