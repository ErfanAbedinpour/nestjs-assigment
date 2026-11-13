import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, connectDatabase, createUser, waitForPayment } from './support.spec';

describe('Payments API and worker with real persistence', () => {
  let db: Client;
  beforeAll(async () => {
    db = await connectDatabase();
  });
  afterAll(async () => {
    await db?.end();
  });
  const submit = (
    userId: string,
    amount: string,
    reference = 'normal',
    key = randomUUID(),
  ) =>
    api()
      .post('/payments')
      .set('Idempotency-Key', key)
      .send({ userId, amount, reference, description: 'E2E payment' });

  it('settles a payment once under concurrent idempotent submissions', async () => {
    const user = await createUser('500');
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 4 }, () => submit(user, '100', 'normal', key)),
    );
    expect(results.every((result) => result.status === 202)).toBe(true);
    expect(new Set(results.map((result) => result.body.id)).size).toBe(1);
    const id = results[0]!.body.id as string;
    expect((await waitForPayment(id, ['SUCCEEDED', 'FAILED'])).status).toBe('SUCCEEDED');
    expect((await api().get(`/users/${user}`)).body).toMatchObject({ balance: '400' });
    expect(
      (await db.query('SELECT amount FROM transactions WHERE payment_id = $1', [id]))
        .rows,
    ).toEqual([{ amount: '100' }]);
    expect((await submit(user, '101', 'normal', key)).status).toBe(409);
    expect((await api().get(`/payments/${id}/events`)).status).toBe(200);
  });

  it('fails insufficient funds once and permits a retry after credit', async () => {
    const user = await createUser('10');
    const created = await submit(user, '100');
    expect(created.status).toBe(202);
    const id = created.body.id as string;
    expect(await waitForPayment(id, ['FAILED'])).toMatchObject({
      attempts: 1,
      failureCode: 'INSUFFICIENT_BALANCE',
    });
    expect((await api().post(`/payments/${id}/retry`)).status).toBe(409);
    expect(
      (
        await api()
          .post(`/users/${user}/credits`)
          .set('Idempotency-Key', randomUUID())
          .send({ amount: '100' })
      ).status,
    ).toBe(201);
    expect((await api().post(`/payments/${id}/retry`)).status).toBe(201);
    expect((await waitForPayment(id, ['SUCCEEDED', 'FAILED'])).status).toBe('SUCCEEDED');
  });

  it('exhausts simulated failures without a debit', async () => {
    const user = await createUser('500');
    const created = await submit(user, '100', 'FAIL-e2e');
    expect(created.status).toBe(202);
    expect(await waitForPayment(created.body.id as string, ['FAILED'])).toMatchObject({
      failureCode: 'SIMULATED_FAILURE',
      attempts: Number(process.env['SYSTEM_TEST_MAX_ATTEMPTS'] ?? 5),
    });
    expect((await api().get(`/users/${user}`)).body).toMatchObject({ balance: '500' });
  });

  it('rejects invalid submissions and missing resources', async () => {
    expect((await api().post('/payments').send({})).status).toBe(400);
    expect((await api().get('/payments/invalid')).status).toBe(400);
    const id = randomUUID();
    expect((await api().get(`/payments/${id}`)).status).toBe(404);
    expect((await api().get(`/payments/${id}/events`)).status).toBe(404);
    expect((await api().post(`/payments/${id}/retry`)).status).toBe(404);
    expect((await api().post(`/payments/${id}/cancel`)).status).toBe(404);
  });
});
