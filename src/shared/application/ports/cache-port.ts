/**
 * Optional read-through cache. Implementations must fail open: a cache outage
 * is never allowed to change a financial decision or fail a request.
 */
export abstract class CachePort {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set<T>(key: string, value: T, ttlMs: number): Promise<void>;
}
