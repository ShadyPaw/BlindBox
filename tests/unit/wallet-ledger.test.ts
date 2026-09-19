import { describe, expect, it } from 'vitest';
import {
  walletPostingSchema,
  walletTransactionsQuerySchema,
  apiEnvSchema,
} from '@box/validation';
import { sessionToken } from '../../apps/api/src/auth/session-cookie.js';

const posting = {
  userId: 'test-user',
  unit: 'USD',
  amountMinor: '699',
  idempotencyKey: 'operation:123',
  referenceType: 'TEST',
  referenceId: 'reference:123',
  description: 'Test credit',
};
describe('wallet contracts', () => {
  it('requires positive canonical integer strings within BIGINT range', () => {
    for (const amountMinor of [
      '0',
      '-1',
      '1.2',
      '1e3',
      '01',
      '9223372036854775808',
      699,
      '',
      'NaN',
    ])
      expect(
        walletPostingSchema.safeParse({ ...posting, amountMinor }).success,
      ).toBe(false);
    expect(
      walletPostingSchema.parse({ ...posting, amountMinor: '9007199254740993' })
        .amountMinor,
    ).toBe('9007199254740993');
    expect(
      walletPostingSchema.parse({
        ...posting,
        amountMinor: '9223372036854775807',
      }).amountMinor,
    ).toBe('9223372036854775807');
  });
  it('requires identity, explicit unit, audit reference and idempotency key', () => {
    for (const field of [
      'userId',
      'unit',
      'referenceType',
      'referenceId',
      'idempotencyKey',
      'description',
    ])
      expect(
        walletPostingSchema.safeParse({ ...posting, [field]: '' }).success,
      ).toBe(false);
    expect(
      walletPostingSchema.safeParse({ ...posting, unit: 'EUR' }).success,
    ).toBe(false);
    expect(
      walletPostingSchema.safeParse({ ...posting, extra: true }).success,
    ).toBe(false);
  });
  it('limits pagination and rejects owner injection and malformed cursors', () => {
    expect(walletTransactionsQuerySchema.parse({})).toEqual({
      unit: 'USD',
      pageSize: 20,
    });
    for (const query of [
      { userId: 'someone' },
      { pageSize: 101 },
      { pageSize: 0 },
      { pageSize: '2.5' },
      { cursor: '-1' },
      { cursor: '0' },
      { unit: 'EUR' },
      { direction: 'ALL' },
    ])
      expect(walletTransactionsQuerySchema.safeParse(query).success).toBe(
        false,
      );
  });
  it('uses the same secure cookie rules and rejects ambiguous sessions', () => {
    const env = apiEnvSchema.parse({
      DATABASE_URL: 'postgresql://test:test@localhost/test',
      REDIS_URL: 'redis://localhost',
    });
    const token = 'a'.repeat(64);
    expect(sessionToken(`box_session=${token}`, env)).toBe(token);
    expect(
      sessionToken(`box_session=${token}; box_session=${token}`, env),
    ).toBeUndefined();
    expect(sessionToken('box_session=malformed', env)).toBeUndefined();
    expect(
      sessionToken(`box_session=${token}`, { ...env, NODE_ENV: 'production' }),
    ).toBeUndefined();
    expect(
      sessionToken(`__Host-box_session=${token}`, {
        ...env,
        NODE_ENV: 'production',
      }),
    ).toBe(token);
  });
});
