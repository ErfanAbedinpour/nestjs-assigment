export type RetryDecision = {
  retry: boolean;
  delayMs: number;
};

export interface JitterSource {
  nextUnitInterval(): number;
}

/**
 * Automatic retries are capped and delayed with exponential backoff plus jitter.
 * The attempt count is owned by the payment, so the decision is a pure function of it.
 */
export class RetryPolicy {
  constructor(
    private readonly maxAttempts: number,
    private readonly baseDelayMs: number,
    private readonly maxDelayMs: number,
    private readonly jitterRatio: number,
    private readonly jitter: JitterSource,
  ) {}

  decide(attempts: number): RetryDecision {
    if (attempts >= this.maxAttempts) {
      return { retry: false, delayMs: 0 };
    }

    const exponent = Math.max(0, attempts - 1);
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** exponent);
    const spread = exponential * this.jitterRatio;
    const offset = spread * (this.jitter.nextUnitInterval() * 2 - 1);
    return { retry: true, delayMs: Math.max(0, Math.round(exponential + offset)) };
  }
}
