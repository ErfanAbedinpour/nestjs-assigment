import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { adminKey, api, createUser, validateEnvironment } from './support.spec';

describe('Admin API', () => {
  beforeAll(async () => {
    validateEnvironment();
    const response = await api()
      .get('/admin/users?page=1&pageSize=1')
      .set('x-admin-api-key', adminKey!);
    if (response.status === 401) {
      throw new Error(
        'SYSTEM_TEST_ADMIN_KEY does not match the admin key of SYSTEM_TEST_API_URL. Configure both for the same disposable test stack.',
      );
    }
    if (response.status !== 200)
      throw new Error(`E2E admin preflight failed with HTTP ${response.status}`);
  });
  const headers = () => ({ 'x-admin-api-key': adminKey! });
  it('protects administrative endpoints and validates requests', async () => {
    expect((await api().get('/admin/users')).status).toBe(401);
    expect(
      (await api().get('/admin/users').set('x-admin-api-key', 'incorrect')).status,
    ).toBe(401);
    expect((await api().get('/admin/users?page=0').set(headers())).status).toBe(400);
    expect(
      (
        await api()
          .get(
            '/admin/reports/transactions/summary?period=daily&from=2026-02-01&to=2026-01-01',
          )
          .set(headers())
      ).status,
    ).toBe(400);
    expect((await api().get(`/admin/users/${randomUUID()}`).set(headers())).status).toBe(
      404,
    );
  });

  it('returns users, transaction history and reports', async () => {
    const userId = await createUser('100');
    expect((await api().get(`/admin/users/${userId}`).set(headers())).body).toMatchObject(
      { id: userId, balance: '100' },
    );
    expect(
      (await api().get(`/admin/users/${userId}/transactions`).set(headers())).body,
    ).toMatchObject({ total: 1 });
    expect(
      (await api().get('/admin/users?page=1&pageSize=10').set(headers())).status,
    ).toBe(200);
    expect((await api().get('/admin/reports/balance-usage').set(headers())).status).toBe(
      200,
    );
    expect(
      (
        await api()
          .get(
            '/admin/reports/transactions/summary?period=daily&from=2020-01-01&to=2029-01-01',
          )
          .set(headers())
      ).status,
    ).toBe(200);
  });
});
