export type ErrorDetails = Record<string, string | number | boolean | null>;

/**
 * A broken business rule. Callers distinguish these from technical failures:
 * domain errors must not be retried unless a more specific rule says so.
 */
export class DomainError extends Error {
  readonly code: string;
  readonly details?: ErrorDetails;

  constructor(code: string, message: string, details?: ErrorDetails) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}
