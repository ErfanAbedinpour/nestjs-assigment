/** Coalesces only concurrent requests in this process; failures are never cached. */
export class CoalesceRequests {
  private readonly pending = new Map<string, Promise<unknown>>();

  run<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    const promise = Promise.resolve().then(load);
    this.pending.set(key, promise);
    void promise.then(
      () => this.pending.delete(key),
      () => this.pending.delete(key),
    );
    return promise;
  }
}
