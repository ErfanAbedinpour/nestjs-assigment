import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, connectDatabase, createUser } from './support.spec';

describe('Users API with real persistence', () => {
  let db: Client;
  beforeAll(async () => {
    db = await connectDatabase();
  });
  afterAll(async () => {
    await db?.end();
  });

  it('registers, credits, replays, and persists the balance and ledger', async () => {
    const userId = await createUser('50');
    const key = randomUUID();
    const first = await api()
      .post(`/users/${userId}/credits`)
      .set('Idempotency-Key', key)
      .send({ amount: '100' });
    expect(first.status).toBe(201);
    const replay = await api()
      .post(`/users/${userId}/credits`)
      .set('Idempotency-Key', key)
      .send({ amount: '100' });
    expect(replay.body).toMatchObject({
      transactionId: first.body.transactionId,
      replayed: true,
    });
    expect(
      (
        await api()
          .post(`/users/${userId}/credits`)
          .set('Idempotency-Key', key)
          .send({ amount: '101' })
      ).status,
    ).toBe(409);
    expect((await api().get(`/users/${userId}`)).body).toMatchObject({ balance: '150' });
    const rows = await db.query('SELECT amount FROM transactions WHERE user_id = $1', [
      userId,
    ]);
    expect(rows.rows.map((row) => row.amount).sort()).toEqual(['100', '50']);
  });

  it('enforces unique email and concurrent idempotent credits', async () => {
    const email = `${randomUUID()}@example.com`;
    const created = await api().post('/users').send({ email, name: 'A' });
    expect(created.status).toBe(201);
    expect(
      (await api().post('/users').send({ email: email.toUpperCase(), name: 'A' })).status,
    ).toBe(409);
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        api()
          .post(`/users/${created.body.id}/credits`)
          .set('Idempotency-Key', key)
          .send({ amount: '25' }),
      ),
    );
    expect(results.every((result) => result.status === 201)).toBe(true);
    expect(new Set(results.map((result) => result.body.transactionId)).size).toBe(1);
    expect((await api().get(`/users/${created.body.id}`)).body).toMatchObject({
      balance: '25',
    });
  });

  it('rejects invalid requests and reports missing users', async () => {
    expect((await api().post('/users').send({ email: 'bad', name: '' })).status).toBe(
      400,
    );
    expect((await api().get('/users/not-a-uuid')).status).toBe(400);
    expect((await api().get(`/users/${randomUUID()}`)).status).toBe(404);
    expect(
      (await api().post(`/users/${randomUUID()}/credits`).send({ amount: '1' })).status,
    ).toBe(400);
    expect(
      (
        await api()
          .post(`/users/${randomUUID()}/credits`)
          .set('Idempotency-Key', randomUUID())
          .send({ amount: '1' })
      ).status,
    ).toBe(404);
  });
});
