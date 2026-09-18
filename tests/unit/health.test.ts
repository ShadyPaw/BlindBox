import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../apps/api/src/app.js';
import { apiEnvSchema, parseEnv } from '@box/validation';

describe('API health', () => {
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });
  async function setup(database = async () => 1, redis = async () => 'PONG') {
    const close = vi.fn(async () => {});
    const app = await createApp(
      parseEnv(apiEnvSchema, {
        DATABASE_URL: 'postgresql://localhost/box',
        REDIS_URL: 'redis://localhost',
        LOG_LEVEL: 'silent',
      }),
      { database, redis, onModuleDestroy: close },
    );
    apps.push(app);
    await app.getHttpAdapter().getInstance().ready();
    return { app, close };
  }
  it('reports liveness independently of dependencies', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', service: 'api' });
  });
  it('reports healthy dependencies', async () => {
    const { app } = await setup();
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(200);
    expect(response.json().checks).toEqual({ database: 'up', redis: 'up' });
  });
  it('returns 503 without leaking dependency errors', async () => {
    const { app } = await setup(async () => {
      throw new Error('secret connection string');
    });
    const response = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(response.statusCode).toBe(503);
    expect(response.json().checks.database).toBe('down');
    expect(response.body).not.toContain('secret');
  });
  it('releases dependencies on shutdown', async () => {
    const { app, close } = await setup();
    await app.close();
    apps.pop();
    expect(close).toHaveBeenCalledOnce();
  });
});
