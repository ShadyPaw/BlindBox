import { describe, expect, it } from 'vitest';
import {
  apiEnvSchema,
  workerEnvSchema,
  parseEnv,
  redisConnection,
} from '@box/validation';
describe('environment validation', () => {
  const valid = {
    DATABASE_URL: 'postgresql://localhost/box',
    REDIS_URL: 'redis://localhost:6379/0',
  };
  it('coerces valid settings and supplies defaults', () => {
    expect(
      parseEnv(apiEnvSchema, { ...valid, API_PORT: '4000' }).API_PORT,
    ).toBe(4000);
    expect(parseEnv(workerEnvSchema, valid).WORKER_CONCURRENCY).toBe(4);
  });
  it.each([
    { API_PORT: '0' },
    { DATABASE_URL: 'http://localhost' },
    { REDIS_URL: 'redis://localhost/nope' },
    { CORS_ORIGINS: '*' },
  ])('rejects invalid API configuration %j', (override) => {
    expect(() => parseEnv(apiEnvSchema, { ...valid, ...override })).toThrow(
      'Invalid environment variables',
    );
  });
  it('does not disclose invalid credentials', () => {
    expect(() =>
      parseEnv(apiEnvSchema, { ...valid, DATABASE_URL: 'secret-password' }),
    ).toThrow(/^Invalid environment variables: DATABASE_URL$/);
  });
  it('parses TLS, credentials and database for Redis', () => {
    expect(redisConnection('rediss://user:p%40ss@localhost:6380/2')).toEqual({
      host: 'localhost',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      db: 2,
      tls: {},
    });
  });
});
