import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../packages/database/dist/index.js';
import { createApp, createDependencies } from '../../apps/api/src/app.js';
import { apiEnvSchema, parseEnv } from '@box/validation';
import type { StorefrontHome } from '@box/types';

describe('homepage PostgreSQL read model', () => {
  const prefix = `home-${randomUUID()}`;
  const env = parseEnv(apiEnvSchema, { ...process.env, LOG_LEVEL: 'silent' });
  const db = createDatabase(env.DATABASE_URL);
  let app: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => {
    app = await createApp(env, createDependencies(env));
    await app.getHttpAdapter().getInstance().ready();
    await db.catalogBox.createMany({
      data: Array.from({ length: 11 }, (_, i) => ({
        id: `${prefix}-${String(i).padStart(2, '0')}`,
        sourceKey: `${prefix}-${i}`,
        slug: `${prefix}-${i}`,
        name: `Home ${i}`,
        image: '/reference/00a997ed93ec5d77.png',
        mode: i === 10 ? 'COIN' : 'CONSUMER',
        priceUnit: i === 10 ? 'COIN' : 'USD',
        priceMinor: 699n,
        category: prefix,
        tags: i === 6 || i === 7 ? ['hot'] : [],
        displayOrder: -2000000000,
        publicationStatus:
          i === 8 ? 'DRAFT' : i === 9 ? 'ARCHIVED' : 'PUBLISHED',
        completenessStatus: 'INCOMPLETE',
      })),
    });
  });
  afterAll(async () => {
    await db.catalogBox.deleteMany({
      where: { sourceKey: { startsWith: prefix } },
    });
    await db.$disconnect();
    await app?.close();
  });
  it('selects published consumer references in stable order and prioritizes hot tags', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/storefront/home',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const data = response.json<StorefrontHome>();
    expect(data.featuredBoxes).toEqual(
      Array.from({ length: 6 }, (_, i) => ({
        mode: 'CONSUMER',
        slug: `${prefix}-${i}`,
      })),
    );
    expect(data.hotBoxes).toHaveLength(6);
    expect(data.hotBoxes.slice(0, 2)).toEqual(
      [6, 7].map((i) => ({ mode: 'CONSUMER', slug: `${prefix}-${i}` })),
    );
    expect(new Set(data.hotBoxes.map((b) => b.slug)).size).toBe(6);
    expect(data.banners).toEqual([]);
    expect(data.featuredCompetitionId).toBeNull();
    expect(JSON.stringify(data)).not.toContain(`${prefix}-8`);
    expect(JSON.stringify(data)).not.toContain(`${prefix}-9`);
    expect(JSON.stringify(data)).not.toContain(`${prefix}-10`);
  });
  it('fills from non-hot records without duplicates when hot records run out', async () => {
    // Use an isolated empty transaction view, then roll back; existing seed data is untouched.
    await db
      .$transaction(async (tx) => {
        await tx.catalogBox.updateMany({ data: { tags: [] } });
        await tx.catalogBox.update({
          where: { id: `${prefix}-07` },
          data: { tags: ['hot'] },
        });
        const { StorefrontQueryService } =
          await import('../../apps/api/src/storefront/service.js');
        const service = new StorefrontQueryService({
          $transaction: (run: (value: typeof tx) => unknown) => run(tx),
        } as unknown as typeof db);
        const result = await service.home();
        expect(result.hotBoxes.map((b) => b.slug)).toEqual(
          [7, 0, 1, 2, 3, 4].map((i) => `${prefix}-${i}`),
        );
        throw new Error('ROLLBACK_TEST');
      })
      .catch((error) => {
        if (error.message !== 'ROLLBACK_TEST') throw error;
      });
  });
});
