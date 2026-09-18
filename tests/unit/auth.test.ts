import { describe, expect, it, vi } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  digest,
  newToken,
} from '../../apps/api/src/auth/crypto.js';
import { redisLimiter } from '../../apps/api/src/auth/service.js';
import { createMailer } from '../../apps/api/src/auth/mail.js';
import {
  apiEnvSchema,
  parseEnv,
  registerSchema,
  resetPasswordSchema,
} from '@box/validation';

describe('authentication security primitives', () => {
  it('normalizes emails and rejects privilege injection, short passwords and invalid reset tokens', () => {
    expect(
      registerSchema.parse({
        email: ' Alice@Example.com ',
        password: 'correct horse battery',
      }).email,
    ).toBe('alice@example.com');
    expect(
      registerSchema.safeParse({
        email: 'a@example.com',
        password: 'correct horse battery',
        role: 'ADMIN',
      }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ email: 'a@example.com', password: 'short' })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        token: '../token',
        password: 'correct horse battery',
      }).success,
    ).toBe(false);
  });
  it('salts passwords, verifies them and rejects wrong passwords', async () => {
    const hash = await hashPassword('a long password with spaces');
    const second = await hashPassword('a long password with spaces');
    expect(hash).not.toBe(second);
    expect(hash).not.toContain('a long password');
    expect(await verifyPassword('a long password with spaces', hash)).toBe(
      true,
    );
    expect(await verifyPassword('wrong password', hash)).toBe(false);
    expect(await verifyPassword('a long password with spaces')).toBe(false);
  }, 15000);
  it('uses random 256-bit tokens and stable one-way lookup digests', () => {
    const token = newToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    expect(newToken()).not.toBe(token);
    expect(digest(token)).not.toBe(token);
    expect(digest(token)).toBe(digest(token));
  });
  it('enforces atomic Redis limits and fails closed when Redis is unavailable', async () => {
    const evalCommand = vi
      .fn()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockRejectedValueOnce(new Error('redis-secret'));
    const limit = redisLimiter({ eval: evalCommand } as unknown as Parameters<
      typeof redisLimiter
    >[0]);
    await expect(limit('test@example.com', 2)).resolves.toBeUndefined();
    await expect(limit('test@example.com', 2)).rejects.toMatchObject({
      status: 429,
    });
    await expect(limit('test@example.com', 2)).rejects.toMatchObject({
      status: 503,
    });
    expect(String(evalCommand.mock.calls[0]?.[2])).not.toContain(
      'test@example.com',
    );
  });
  it('forbids file mail in production', () => {
    const env = parseEnv(apiEnvSchema, {
      DATABASE_URL: 'postgresql://localhost/box',
      REDIS_URL: 'redis://localhost',
      NODE_ENV: 'production',
      MAIL_TRANSPORT: 'file',
    });
    expect(() => createMailer(env)).toThrow('forbidden in production');
  });
});
