import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createDatabase } from '../../packages/database/dist/index.js';

const base = 'http://127.0.0.1:3100';
test('real wallet proxy authenticates, returns zero, and cannot mint funds', async ({
  request,
}) => {
  const db = createDatabase(process.env.DATABASE_URL!);
  const email = `wallet-browser-${randomUUID()}@example.com`;
  try {
    expect((await request.get(`${base}/api/wallet/balances`)).status()).toBe(
      401,
    );
    const registration = await request.post(`${base}/api/auth/register`, {
      headers: { origin: base, 'x-box-csrf': '1' },
      data: { email, password: 'Wallet browser regression 123!' },
    });
    expect(registration.status()).toBe(201);
    const balance = await request.get(`${base}/api/wallet/balances`);
    expect(balance.status()).toBe(200);
    expect(balance.headers()['cache-control']).toBe('no-store');
    expect(await balance.json()).toEqual({
      balances: [
        { unit: 'USD', availableMinor: '0' },
        { unit: 'COIN', availableMinor: '0' },
      ],
    });
    const history = await request.get(
      `${base}/api/wallet/transactions?unit=COIN`,
    );
    expect(await history.json()).toEqual({
      transactions: [],
      nextCursor: null,
    });
    expect(
      (
        await request.get(`${base}/api/wallet/balances?userId=someone-else`)
      ).status(),
    ).toBe(400);
    expect(
      (
        await request.post(`${base}/api/wallet/balances`, {
          data: { amountMinor: '999999' },
        })
      ).status(),
    ).toBe(405);
    expect((await request.get(`${base}/api/wallet/credit`)).status()).toBe(404);
    await request.post(`${base}/api/auth/logout`, {
      headers: { origin: base, 'x-box-csrf': '1' },
      data: {},
    });
    expect(
      (await request.get(`${base}/api/wallet/transactions`)).status(),
    ).toBe(401);
  } finally {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});

test('wallet API failure is explicit and never returns prototype balances', async ({
  request,
}) => {
  const response = await request.get(
    'http://127.0.0.1:3104/api/wallet/balances',
  );
  expect(response.status()).toBe(503);
  expect(await response.json()).toEqual({
    message: 'Wallet service unavailable',
  });
  expect(response.headers()['cache-control']).toBe('no-store');
});
