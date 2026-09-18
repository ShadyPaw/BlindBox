import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../packages/database/dist/index.js';
import { createApp, createDependencies } from '../../apps/api/src/app.js';
import { AuthService } from '../../apps/api/src/auth/service.js';
import { digest } from '../../apps/api/src/auth/crypto.js';
import { apiEnvSchema, parseEnv } from '@box/validation';

describe('authentication against PostgreSQL and Redis', () => {
  const env = parseEnv(apiEnvSchema, {
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    CORS_ORIGINS: 'http://localhost:3000',
  });
  const db = createDatabase(env.DATABASE_URL);
  const mails: { email: string; url: string }[] = [];
  const email = `auth-${randomUUID()}@example.com`;
  const password = 'Initial password! 12345';
  const nextPassword = 'Replacement password! 67890';
  let app: Awaited<ReturnType<typeof createApp>>;
  let cookie: string;
  let userId: string;
  const headers = { origin: 'http://localhost:3000', 'x-box-csrf': '1' };
  const post = (
    action: string,
    payload: object,
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method: 'POST',
      url: `/auth/${action}`,
      headers: { ...headers, ...extra },
      payload,
    });
  beforeAll(async () => {
    const deps = createDependencies(env);
    deps.auth!.service = new AuthService(db, env, {
      send: async (to, url) => {
        mails.push({ email: to, url });
      },
    });
    app = await createApp(env, deps);
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
    await app?.close();
  });
  it('rejects missing/foreign Origin and role injection', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/register',
          payload: { email, password },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await post(
          'register',
          { email, password },
          { origin: 'https://evil.example' },
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await post('register', { email, password, role: 'ADMIN' })).statusCode,
    ).toBe(400);
  });
  it('registers a USER with a hashed password and a private cookie', async () => {
    const response = await post('register', {
      email: email.toUpperCase(),
      password,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().user.role).toBe('USER');
    expect(response.json().user.email).toBe(email);
    expect(response.body).not.toContain('password');
    expect(response.body).not.toContain('token');
    cookie = String(response.headers['set-cookie']).split(';')[0]!;
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Lax');
    expect(response.headers['cache-control']).toBe('no-store');
    userId = response.json().user.id;
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(
      await db.session.findUnique({
        where: { tokenHash: digest(cookie.split('=')[1]!) },
      }),
    ).not.toBeNull();
    expect((await post('register', { email, password })).statusCode).toBe(409);
  });
  it('reads only the current account and rejects anonymous/admin access', async () => {
    expect(
      (await app.inject({ method: 'GET', url: '/auth/me' })).statusCode,
    ).toBe(401);
    const me = await app.inject({
      method: 'GET',
      url: '/auth/me?userId=someone-else',
      headers: { cookie },
    });
    expect(me.json().user.id).toBe(userId);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/auth/admin/session',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(403);
    await db.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/auth/admin/session',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(200);
    await db.user.update({ where: { id: userId }, data: { role: 'USER' } });
  });
  it('revokes logout cookies and rejects incorrect passwords', async () => {
    expect((await post('logout', {}, { cookie })).statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/auth/me',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(401);
    expect((await post('login', { email, password: 'wrong' })).statusCode).toBe(
      401,
    );
    const response = await post('login', { email, password });
    expect(response.statusCode).toBe(200);
    cookie = String(response.headers['set-cookie']).split(';')[0]!;
  });
  it('delivers only out-of-band reset tokens and accepts one concurrent reset', async () => {
    const known = await post('forgot-password', { email });
    const unknown = await post('forgot-password', {
      email: `missing-${randomUUID()}@example.com`,
    });
    expect(known.statusCode).toBe(200);
    expect(known.body).toBe(unknown.body);
    const token = new URL(mails[0]!.url).hash.slice(1);
    expect(known.body).not.toContain(token);
    const results = await Promise.all([
      post('reset-password', { token, password: nextPassword }),
      post('reset-password', { token, password: nextPassword }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 400]);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/auth/me',
          headers: { cookie },
        })
      ).statusCode,
    ).toBe(401);
    expect((await post('reset-password', { token, password })).statusCode).toBe(
      400,
    );
    expect((await post('login', { email, password })).statusCode).toBe(401);
    expect(
      (await post('login', { email, password: nextPassword })).statusCode,
    ).toBe(200);
  });
  it('rejects expired sessions and reset tokens', async () => {
    await db.session.create({
      data: {
        userId,
        tokenHash: digest('a'.repeat(64)),
        expiresAt: new Date(0),
      },
    });
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/auth/me',
          headers: { cookie: `box_session=${'a'.repeat(64)}` },
        })
      ).statusCode,
    ).toBe(401);
    await db.passwordResetToken.create({
      data: {
        userId,
        tokenHash: digest('b'.repeat(64)),
        expiresAt: new Date(0),
      },
    });
    expect(
      (await post('reset-password', { token: 'b'.repeat(64), password }))
        .statusCode,
    ).toBe(400);
  });
  it('limits repeated login attempts', async () => {
    const target = `rate-${randomUUID()}@example.com`;
    for (let i = 0; i < 10; i++)
      expect(
        (await post('login', { email: target, password })).statusCode,
      ).toBe(401);
    expect((await post('login', { email: target, password })).statusCode).toBe(
      429,
    );
  });
});
