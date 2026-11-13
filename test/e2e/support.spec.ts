import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import supertest from 'supertest';
import { expect } from 'vitest';

export const apiUrl = process.env['SYSTEM_TEST_API_URL'] ?? 'http://localhost:3000';
export const databaseUrl = process.env['DATABASE_URL'];
export const adminKey = process.env['SYSTEM_TEST_ADMIN_KEY'] ?? 'test';

export function validateEnvironment(): void {
  if (
    process.env['SYSTEM_TEST_ISOLATED'] !== 'yes' ||
    !apiUrl ||
    !databaseUrl ||
    !adminKey
  ) {
    throw new Error(
      'Use a disposable test stack and set SYSTEM_TEST_ISOLATED=yes, SYSTEM_TEST_API_URL, SYSTEM_TEST_DATABASE_URL and SYSTEM_TEST_ADMIN_KEY',
    );
  }
}

export function api() {
  validateEnvironment();
  return supertest(apiUrl!);
}

export async function connectDatabase(): Promise<Client> {
  validateEnvironment();
  const db = new Client({ connectionString: databaseUrl });
  try {
    await db.connect();
  } catch (error) {
    const host = new URL(databaseUrl!).hostname;
    throw new Error(
      `Cannot connect to the E2E database host "${host}". Set SYSTEM_TEST_DATABASE_URL to the disposable database address reachable from the test process (use localhost and the published port when running tests on the host).`,
      { cause: error },
    );
  }
  return db;
}

export async function createUser(balance = '0'): Promise<string> {
  const response = await api()
    .post('/users')
    .send({
      email: `${randomUUID()}@example.com`,
      name: 'E2E user',
      ...(balance === '0' ? {} : { initialBalance: balance }),
    });
  expect(response.status).toBe(201);
  return response.body.id as string;
}

export async function waitForPayment(
  id: string,
  statuses: string[],
): Promise<{ status: string; attempts: number; failureCode: string | null }> {
  const deadline = Date.now() + 40000;
  let lastPayment:
    { status: string; attempts: number; failureCode: string | null } | undefined;
  while (Date.now() < deadline) {
    const response = await api().get(`/payments/${id}`);
    expect(response.status).toBe(200);
    lastPayment = response.body as typeof lastPayment;
    if (lastPayment && statuses.includes(lastPayment.status)) return lastPayment;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const events = await api().get(`/payments/${id}/events`);
  throw new Error(
    `Payment ${id} did not reach ${statuses.join(' or ')} within 40 seconds. ` +
      `Last state: ${JSON.stringify(lastPayment ?? null)}. ` +
      `Events: ${JSON.stringify(events.status === 200 ? events.body : { status: events.status })}. ` +
      'Check that the test worker is running and connected to the same database and RabbitMQ as the API.',
  );
}
