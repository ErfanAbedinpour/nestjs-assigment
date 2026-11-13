import { describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../../infrastructure/cache/redis/redis.service';
import { RedisCacheAdapter } from '../redis-cache.adapter';

describe('RedisCacheAdapter', () => {
  it('reads and writes values using the supplied TTL', async () => {
    const cache = {
      get: vi.fn().mockResolvedValueOnce({ value: 1 }).mockResolvedValueOnce(null),
      set: vi.fn(),
    };
    const adapter = new RedisCacheAdapter({
      getCacheManager: () => cache,
    } as unknown as RedisService);
    await expect(adapter.get('key')).resolves.toEqual({ value: 1 });
    await expect(adapter.get('missing')).resolves.toBeUndefined();
    await adapter.set('key', { value: 1 }, 500);
    expect(cache.set).toHaveBeenCalledWith('key', { value: 1 }, 500);
  });

  it('continues when cache reads or writes fail', async () => {
    const cache = {
      get: vi.fn().mockRejectedValue(new Error('offline')),
      set: vi.fn().mockRejectedValue('offline'),
    };
    const adapter = new RedisCacheAdapter({
      getCacheManager: () => cache,
    } as unknown as RedisService);
    await expect(adapter.get('key')).resolves.toBeUndefined();
    await expect(adapter.set('key', 1, 100)).resolves.toBeUndefined();
  });
});
