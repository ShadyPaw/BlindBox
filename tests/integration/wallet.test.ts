import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../packages/database/dist/index.js';
import {
  WalletLedgerService,
  walletAccountId,
} from '../../apps/api/src/wallet/ledger-service.js';
import { WalletQueryService } from '../../apps/api/src/wallet/query-service.js';
import { createApp, createDependencies } from '../../apps/api/src/app.js';
import { digest } from '../../apps/api/src/auth/crypto.js';
import { apiEnvSchema, type WalletPosting } from '@box/validation';
import { MAX_MINOR } from '@box/money';

describe('wallet PostgreSQL ledger and authenticated reads', () => {
  const env = apiEnvSchema.parse({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
  });
  const db = createDatabase(env.DATABASE_URL);
  const ledger = new WalletLedgerService(db);
  const queries = new WalletQueryService(db);
  const prefix = `wallet-test-${randomUUID()}`;
  const token =
    randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  let userId: string;
  let otherId: string;
  let app: Awaited<ReturnType<typeof createApp>>;
  const command = (overrides: Partial<WalletPosting> = {}): WalletPosting => ({
    userId,
    unit: 'USD',
    amountMinor: '1000',
    idempotencyKey: randomUUID(),
    referenceType: 'TEST',
    referenceId: randomUUID(),
    description: 'Isolated wallet integration fixture',
    ...overrides,
  });
  async function newUser(suffix: string) {
    return (
      await db.user.create({
        data: {
          email: `${prefix}-${suffix}@example.com`,
          passwordHash: 'not-a-login-hash',
        },
      })
    ).id;
  }
  const get = (path: string, cookie = `box_session=${token}`) =>
    app.inject({ method: 'GET', url: `/wallet/${path}`, headers: { cookie } });
  beforeAll(async () => {
    userId = await newUser('owner');
    otherId = await newUser('other');
    await db.session.create({
      data: {
        tokenHash: digest(token),
        userId,
        expiresAt: new Date(Date.now() + 600000),
      },
    });
    app = await createApp(env, createDependencies(env));
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await db.session.deleteMany({ where: { tokenHash: digest(token) } });
    // Posted audit fixtures intentionally remain in the isolated TEST database. Never disable
    // immutability triggers just to clean up tests; unposted users can be removed normally.
    await db.user.deleteMany({
      where: { email: { startsWith: prefix }, walletAccounts: { none: {} } },
    });
    await app?.close();
    await db.$disconnect();
  });

  it('reads zero balances for pre-existing users without creating or funding accounts', async () => {
    const response = await get('balances');
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      balances: [
        { unit: 'USD', availableMinor: '0' },
        { unit: 'COIN', availableMinor: '0' },
      ],
    });
    expect(await db.walletAccount.count({ where: { userId } })).toBe(0);
    expect((await get('transactions')).json()).toEqual({
      transactions: [],
      nextCursor: null,
    });
  });

  it('posts exact amounts, immutable after-balances and independent currencies', async () => {
    const usd = await ledger.credit(
      command({ amountMinor: '9007199254740993' }),
    );
    expect(usd.balanceAfterMinor).toBe('9007199254740993');
    const debit = await ledger.debit(
      command({ amountMinor: '9007199254740493' }),
    );
    expect(debit.balanceAfterMinor).toBe('500');
    await ledger.credit(command({ unit: 'COIN', amountMinor: '73' }));
    expect((await get('balances')).json()).toEqual({
      balances: [
        { unit: 'USD', availableMinor: '500' },
        { unit: 'COIN', availableMinor: '73' },
      ],
    });
    expect(await queries.reconcile()).toEqual([]);
  });

  it('serializes concurrent replays and rejects changed payloads without extra money', async () => {
    const input = command({ amountMinor: '100' });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => ledger.credit(input)),
    );
    expect(new Set(results.map((row) => row.id)).size).toBe(1);
    expect(results.every((row) => row.balanceAfterMinor === '600')).toBe(true);
    for (const change of [
      { amountMinor: '101' },
      { userId: otherId },
      { unit: 'COIN' as const },
      { referenceId: randomUUID() },
      { description: 'changed' },
    ])
      await expect(
        ledger.credit({ ...input, ...change }),
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    await expect(ledger.debit(input)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    expect(
      await db.walletTransfer.count({
        where: { idempotencyKey: input.idempotencyKey },
      }),
    ).toBe(1);
  });

  it('rejects duplicate business references even with different request keys', async () => {
    const input = command({ amountMinor: '1' });
    const before = await queries.balances(userId);
    const results = await Promise.allSettled([
      ledger.credit(input),
      ledger.credit({ ...input, idempotencyKey: randomUUID() }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({ reason: { code: 'REFERENCE_CONFLICT' } });
    const after = await queries.balances(userId);
    expect(
      BigInt(after.balances[0]!.availableMinor) -
        BigInt(before.balances[0]!.availableMinor),
    ).toBe(1n);
    expect(await queries.reconcile()).toEqual([]);
  });

  it('never overspends under concurrent distinct debit requests', async () => {
    const racer = await newUser('race');
    await ledger.credit(command({ userId: racer, amountMinor: '1000' }));
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        ledger.debit(command({ userId: racer, amountMinor: '300' })),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(3);
    const failures = results.filter((result) => result.status === 'rejected');
    expect(failures).toHaveLength(5);
    for (const result of failures)
      expect(result.reason).toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    expect((await queries.balances(racer)).balances[0]!.availableMinor).toBe(
      '100',
    );
    expect(
      await db.walletTransfer.count({
        where: { fromAccount: { userId: racer } },
      }),
    ).toBe(3);
    expect(await queries.reconcile()).toEqual([]);
  });

  it('rolls back posting and idempotency claim with an outer business failure', async () => {
    const input = command({ amountMinor: '50' });
    const before = await queries.balances(userId);
    await expect(
      db.$transaction(async (tx) => {
        await ledger.debitInTransaction(tx, input);
        // Represents a later business write failing; no Opening Engine model is created here.
        await tx.$queryRaw`SELECT 1 / 0`;
      }),
    ).rejects.toThrow();
    expect(await queries.balances(userId)).toEqual(before);
    expect(
      await db.walletTransfer.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      }),
    ).toBeNull();
    const posted = await ledger.debit(input);
    expect(posted.amountMinor).toBe('50');
    expect(await ledger.debit(input)).toEqual(posted);
  });

  it('rolls back lazy account creation, rejects missing users and BIGINT overflow', async () => {
    const fresh = await newUser('rollback');
    await expect(
      ledger.debit(command({ userId: fresh })),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_FUNDS' });
    expect(await db.walletAccount.count({ where: { userId: fresh } })).toBe(0);
    await expect(
      ledger.credit(command({ userId: 'missing-user' })),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    await expect(
      ledger.credit(command({ amountMinor: (MAX_MINOR + 1n).toString() })),
    ).rejects.toMatchObject({ code: 'INVALID_POSTING' });
    const clearing = await db.walletAccount.findUniqueOrThrow({
      where: { id: 'clearing:USD' },
    });
    await expect(
      db.$transaction(async (tx) => {
        await ledger.creditInTransaction(
          tx,
          command({
            userId: fresh,
            amountMinor: (MAX_MINOR + clearing.balanceMinor).toString(),
          }),
        );
        await ledger.creditInTransaction(
          tx,
          command({ userId: fresh, amountMinor: '2' }),
        );
      }),
    ).rejects.toMatchObject({ code: 'AMOUNT_OVERFLOW' });
    expect(await db.walletAccount.count({ where: { userId: fresh } })).toBe(0);
    expect(await queries.reconcile()).toEqual([]);
  });

  it('enforces append-only storage, owner retention and projection-only balance writes', async () => {
    const row = await db.walletTransfer.findFirstOrThrow({
      where: { toAccount: { userId } },
    });
    await expect(
      db.walletTransfer.update({
        where: { id: row.id },
        data: { description: 'tampered' },
      }),
    ).rejects.toThrow('WALLET_LEDGER_IMMUTABLE');
    await expect(
      db.walletTransfer.delete({ where: { id: row.id } }),
    ).rejects.toThrow('WALLET_LEDGER_IMMUTABLE');
    await expect(
      db.walletAccount.update({
        where: { id: walletAccountId(userId, 'USD') },
        data: { balanceMinor: 999n },
      }),
    ).rejects.toThrow('WALLET_DIRECT_BALANCE_WRITE');
    await expect(
      db.walletAccount.update({
        where: { id: walletAccountId(userId, 'USD') },
        data: { userId: otherId },
      }),
    ).rejects.toThrow('WALLET_ACCOUNT_IMMUTABLE');
    await expect(db.user.delete({ where: { id: userId } })).rejects.toThrow();
    await expect(
      db.walletAccount.create({
        data: {
          id: randomUUID(),
          userId: otherId,
          kind: 'USER',
          unit: 'USD',
          balanceMinor: 1n,
        },
      }),
    ).rejects.toThrow('WALLET_DIRECT_BALANCE_WRITE');
  });

  it('does not post balances for a raw SQL conflict-skipped insert; rejects cross-unit transfers', async () => {
    const original = await db.walletTransfer.findFirstOrThrow({
      where: { toAccount: { userId }, unit: 'USD', amountMinor: 100n },
    });
    const before = await queries.balances(userId);
    await db.$executeRaw`INSERT INTO "WalletTransfer" ("id", "idempotencyKey", "requestHash", "referenceType", "referenceId", "direction", "description", "unit", "amountMinor", "fromAccountId", "toAccountId")
      SELECT "id", "idempotencyKey", "requestHash", "referenceType", "referenceId", "direction", "description", "unit", "amountMinor", "fromAccountId", "toAccountId"
      FROM "WalletTransfer" WHERE id = ${original.id} ON CONFLICT DO NOTHING`;
    expect(await queries.balances(userId)).toEqual(before);
    await expect(
      db.walletTransfer.create({
        data: {
          id: randomUUID(),
          idempotencyKey: randomUUID(),
          requestHash: 'test',
          referenceType: 'TEST',
          referenceId: randomUUID(),
          description: 'Cross unit',
          direction: 'CREDIT',
          unit: 'USD',
          amountMinor: 1n,
          fromAccountId: 'clearing:COIN',
          toAccountId: walletAccountId(userId, 'USD'),
        },
      }),
    ).rejects.toThrow('WALLET_INVALID_TRANSFER');
    expect(await queries.reconcile()).toEqual([]);
  });

  it('isolates users, paginates/filter reads, rejects injection and exposes no write routes', async () => {
    await ledger.credit(command({ userId: otherId, amountMinor: '20' }));
    const first = await get('transactions?unit=USD&pageSize=2');
    expect(first.statusCode).toBe(200);
    const data = first.json();
    expect(data.transactions).toHaveLength(2);
    expect(typeof data.nextCursor).toBe('string');
    const second = (
      await get(`transactions?unit=USD&pageSize=2&cursor=${data.nextCursor}`)
    ).json();
    expect(
      second.transactions.some((item: { id: string }) =>
        data.transactions.some((old: { id: string }) => old.id === item.id),
      ),
    ).toBe(false);
    const coins = (await get('transactions?unit=COIN')).json();
    expect(coins.transactions).toHaveLength(1);
    expect(coins.transactions[0]).toMatchObject({
      unit: 'COIN',
      amountMinor: '73',
      direction: 'CREDIT',
    });
    const debits = (await get('transactions?direction=DEBIT')).json();
    expect(
      debits.transactions.every(
        (item: { direction: string }) => item.direction === 'DEBIT',
      ),
    ).toBe(true);
    expect((await get(`transactions?userId=${otherId}`)).statusCode).toBe(400);
    expect((await get(`balances?userId=${otherId}`)).statusCode).toBe(400);
    expect((await get('transactions?pageSize=101')).statusCode).toBe(400);
    expect((await get('transactions?cursor=1.2')).statusCode).toBe(400);
    expect((await get('transactions?cursor=abc')).statusCode).toBe(400);
    expect((await get('balances', '')).statusCode).toBe(401);
    expect(
      (await get('balances', `box_session=${token}; box_session=${token}`))
        .statusCode,
    ).toBe(401);
    const owned = await db.walletTransfer.findMany({
      where: {
        OR: [{ fromAccount: { userId } }, { toAccount: { userId } }],
        unit: 'USD',
      },
    });
    const all = (await get('transactions?pageSize=100')).json();
    expect(
      all.transactions.map((item: { id: string }) => item.id).sort(),
    ).toEqual(owned.map((item) => item.id).sort());
    for (const path of ['credit', 'debit', 'transfer', 'balances'])
      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/wallet/${path}`,
            headers: { cookie: `box_session=${token}` },
            payload: { amountMinor: '100' },
          })
        ).statusCode,
      ).toBe(404);
    await db.session.update({
      where: { tokenHash: digest(token) },
      data: { expiresAt: new Date(0) },
    });
    expect((await get('balances')).statusCode).toBe(401);
  });
});
