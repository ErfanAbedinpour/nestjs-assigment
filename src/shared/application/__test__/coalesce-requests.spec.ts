import { describe, expect, it, vi } from 'vitest';
import { CoalesceRequests } from '../coalesce-requests';

describe('CoalesceRequests', () => {
  it('shares concurrent loads and permits a new load after completion', async () => {
    const coalescer = new CoalesceRequests();
    let resolve!: (value: number) => void;
    const load = vi.fn(
      () =>
        new Promise<number>((done) => {
          resolve = done;
        }),
    );
    const first = coalescer.run('report', load);
    const second = coalescer.run('report', load);
    await Promise.resolve();
    expect(load).toHaveBeenCalledOnce();
    resolve(42);
    await expect(Promise.all([first, second])).resolves.toEqual([42, 42]);
    await expect(coalescer.run('report', async () => 43)).resolves.toBe(43);
  });

  it('does not retain a failed load', async () => {
    const coalescer = new CoalesceRequests();
    await expect(
      coalescer.run('report', async () => {
        throw new Error('offline');
      }),
    ).rejects.toThrow('offline');
    await expect(coalescer.run('report', async () => 1)).resolves.toBe(1);
  });
});
