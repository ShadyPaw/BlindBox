import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabase } from '../../packages/database/dist/index.js';
import {
  seedCatalog,
  type CatalogSeedBox,
} from '../../packages/database/dist/seed-catalog.js';
import { createApp, createDependencies } from '../../apps/api/src/app.js';
import { apiEnvSchema, parseEnv } from '@box/validation';
import type { CatalogDetail, CatalogList } from '@box/types';

describe('catalog PostgreSQL import and public queries', () => {
  const prefix = `catalog-${randomUUID()}`;
  const env = parseEnv(apiEnvSchema, { ...process.env, LOG_LEVEL: 'silent' });
  const db = createDatabase(env.DATABASE_URL);
  let app: Awaited<ReturnType<typeof createApp>>;
  const boxes: CatalogSeedBox[] = Array.from({ length: 12 }, (_, index) => ({
    sourceKey: `${prefix}.box.${index}`,
    slug: `${prefix}-${index}`,
    name: `${prefix} ${index}`,
    description: null,
    image: '/reference/00a997ed93ec5d77.png',
    mode: index === 11 ? 'COIN' : 'CONSUMER',
    category: index < 4 ? `${prefix}-same` : `${prefix}-other`,
    tags: index % 2 ? ['hot'] : ['new'],
    displayOrder: index,
    publicationStatus:
      index === 9 ? 'DRAFT' : index === 10 ? 'ARCHIVED' : 'PUBLISHED',
    completenessStatus: index === 0 ? 'COMPLETE' : 'INCOMPLETE',
    price: index === 11 ? '500' : '6.99',
    priceUnit: index === 11 ? 'COIN' : 'USD',
    items:
      index === 0
        ? [null, '0.125'].map((probability, order) => ({
            sourceKey: `${prefix}.item.${order}`,
            name: `Item ${order}`,
            image: '/reference/00a997ed93ec5d77.png',
            displayOrder: order,
            displayValue: '90071992547409.93',
            displayValueUnit: 'USD',
            displayProbabilityPercent: probability,
          }))
        : [],
  }));
  const get = (path: string) =>
    app.inject({ method: 'GET', url: `/catalog/boxes${path}` });
  beforeAll(async () => {
    app = await createApp(env, createDependencies(env));
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => {
    await db.catalogBoxItem.deleteMany({
      where: { sourceKey: { startsWith: prefix } },
    });
    await db.catalogBox.deleteMany({
      where: { sourceKey: { startsWith: prefix } },
    });
    await db.$disconnect();
    await app?.close();
  });
  it('inserts once, then skips without duplicate rows or overwriting operator edits', async () => {
    expect(await seedCatalog(db, boxes)).toEqual({
      insertedBoxes: 12,
      skippedBoxes: 0,
      insertedItems: 2,
      skippedItems: 0,
    });
    await db.catalogBox.update({
      where: { sourceKey: boxes[0]!.sourceKey },
      data: {
        name: `${prefix} Edited`,
        priceMinor: 123n,
        tags: ['hot'],
        displayOrder: 15,
      },
    });
    await db.catalogBoxItem.update({
      where: { sourceKey: boxes[0]!.items[0]!.sourceKey },
      data: { name: 'Edited item' },
    });
    expect(await seedCatalog(db, boxes)).toEqual({
      insertedBoxes: 0,
      skippedBoxes: 12,
      insertedItems: 0,
      skippedItems: 2,
    });
    const stored = await db.catalogBox.findUniqueOrThrow({
      where: { sourceKey: boxes[0]!.sourceKey },
    });
    expect(stored).toMatchObject({
      name: `${prefix} Edited`,
      priceMinor: 123n,
      tags: ['hot'],
      displayOrder: 15,
    });
    expect(
      (
        await db.catalogBoxItem.findUniqueOrThrow({
          where: { sourceKey: boxes[0]!.items[0]!.sourceKey },
        })
      ).name,
    ).toBe('Edited item');
    expect(
      await db.catalogBox.count({
        where: { sourceKey: { startsWith: prefix } },
      }),
    ).toBe(12);
    expect(
      await db.catalogBoxItem.count({
        where: { sourceKey: { startsWith: prefix } },
      }),
    ).toBe(2);
  });
  it('rolls back the entire import on non-sourceKey conflicts and invalid amounts', async () => {
    const fresh: CatalogSeedBox = {
      ...boxes[1]!,
      sourceKey: `${prefix}.rollback`,
      slug: `${prefix}-rollback`,
    };
    await expect(
      seedCatalog(db, [
        fresh,
        { ...boxes[1]!, sourceKey: `${prefix}.collision` },
      ]),
    ).rejects.toThrow();
    expect(
      await db.catalogBox.findUnique({ where: { sourceKey: fresh.sourceKey } }),
    ).toBeNull();
    await expect(
      seedCatalog(db, [fresh, { ...boxes[2]!, price: '1.001' }]),
    ).rejects.toThrow();
    expect(
      await db.catalogBox.findUnique({ where: { sourceKey: fresh.sourceKey } }),
    ).toBeNull();
  });
  it('filters published records with exact minor units, category, tag, and stable pagination', async () => {
    const all = (await get(`?search=${prefix}`)).json<CatalogList>();
    expect(all.total).toBe(9);
    const one = (
      await get(`?search=${prefix}&maxPriceMinor=123&tag=hot`)
    ).json<CatalogList>();
    expect(one.boxes.map((b) => b.name)).toEqual([`${prefix} Edited`]);
    expect(one.boxes[0]).toMatchObject({
      priceMinor: '123',
      price: '1.23',
      priceUnit: 'USD',
    });
    const category = (
      await get(`?search=${prefix}&category=${prefix}-same`)
    ).json<CatalogList>();
    expect(category.boxes).toHaveLength(4);
    const sorted = (await get(`?search=${prefix}&sort=low`)).json<CatalogList>()
      .boxes;
    expect(sorted[0]!.priceMinor).toBe('123');
    expect(sorted.slice(1).map((b) => b.id)).toEqual(
      sorted
        .slice(1)
        .map((b) => b.id)
        .sort(),
    );
    const page1 = (
      await get(`?search=${prefix}&sort=low&pageSize=3`)
    ).json<CatalogList>();
    const page2 = (
      await get(`?search=${prefix}&sort=low&pageSize=3&page=2`)
    ).json<CatalogList>();
    expect([...page1.boxes, ...page2.boxes]).toEqual(sorted.slice(0, 6));
    expect(
      (
        await get(`?search=${prefix}&minPriceMinor=700&maxPriceMinor=100`)
      ).json<CatalogList>().boxes,
    ).toEqual([]);
    expect(
      (await get(`?search=${prefix}&mode=COIN`))
        .json<CatalogList>()
        .boxes.map((b) => b.slug),
    ).toEqual([boxes[11]!.slug]);
  });
  it('retains previous catalog search and sorting semantics against the real database', async () => {
    // These replace the former in-memory filter tests, retaining their behavior checks.
    const query = await get('?search=%20%20CHARIZARD%20&maxPriceMinor=200');
    expect(query.json<CatalogList>().boxes.map((b) => b.name)).toEqual([
      'Charizard Across Eras',
    ]);
    expect((await get('?sort=low')).json<CatalogList>().boxes[0]!.name).toBe(
      'One Piece Voyage',
    );
    expect(
      (await get('?category=collectibles'))
        .json<CatalogList>()
        .boxes.every((b) => b.category === 'collectibles'),
    ).toBe(true);
    expect((await get('')).json<CatalogList>().boxes[0]!.name).toBe(
      'Everyday Sync',
    );
  });
  it('distinguishes 404 from incomplete details and preserves display-only percentages', async () => {
    for (const slug of [boxes[9]!.slug, boxes[10]!.slug, `${prefix}-missing`])
      expect((await get(`/${slug}`)).statusCode).toBe(404);
    const incomplete = await get(`/${boxes[1]!.slug}`);
    expect(incomplete.statusCode).toBe(200);
    expect(incomplete.json<CatalogDetail>()).toMatchObject({
      box: { completenessStatus: 'INCOMPLETE' },
      items: [],
    });
    const detail = (await get(`/${boxes[0]!.slug}`)).json<CatalogDetail>();
    expect(detail.items.map((item) => item.displayProbabilityPercent)).toEqual([
      null,
      '0.125',
    ]);
    expect(detail.items[0]!.displayValueMinor).toBe('9007199254740993');
    expect(detail.relatedBoxes).toHaveLength(6);
    expect(detail.relatedBoxes.slice(0, 3).map((b) => b.slug)).toEqual(
      boxes.slice(1, 4).map((b) => b.slug),
    );
    expect(
      detail.relatedBoxes.every(
        (b) => b.mode === 'CONSUMER' && b.id !== detail.box.id,
      ),
    ).toBe(true);
    expect(
      detail.relatedBoxes.some((b) =>
        [boxes[9]!.slug, boxes[10]!.slug].includes(b.slug),
      ),
    ).toBe(false);
    expect(
      detail.relatedBoxes.slice(3).map((b) => [b.displayOrder, b.id]),
    ).toEqual(
      [...detail.relatedBoxes.slice(3)]
        .sort(
          (a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id),
        )
        .map((b) => [b.displayOrder, b.id]),
    );
    const coin = (
      await get(`/${boxes[11]!.slug}?mode=COIN`)
    ).json<CatalogDetail>();
    expect(coin.relatedBoxes).toHaveLength(6);
    expect(coin.relatedBoxes.every((b) => b.mode === 'COIN')).toBe(true);
    await db.catalogBoxItem.update({
      where: { sourceKey: boxes[0]!.items[1]!.sourceKey },
      data: { displayProbabilityPercent: '0.000000000001' },
    });
    const precise = (await get(`/${boxes[0]!.slug}`)).json<CatalogDetail>();
    expect(precise.items[1]!.displayProbabilityPercent).toBe('0.000000000001');
  });
  it('resolves shared slugs within their mode while preserving both existing URLs', async () => {
    const consumer = await get('/pocket-paradise');
    const coin = await get('/pocket-paradise?mode=COIN');
    expect(consumer.statusCode).toBe(200);
    expect(coin.statusCode).toBe(200);
    expect(consumer.json<CatalogDetail>().box.mode).toBe('CONSUMER');
    expect(coin.json<CatalogDetail>().box.mode).toBe('COIN');
    expect(consumer.json<CatalogDetail>().box.id).not.toBe(
      coin.json<CatalogDetail>().box.id,
    );
    expect((await get('/pocket-paradise?mode=OTHER')).statusCode).toBe(400);
    expect((await get(`/${boxes[11]!.slug}?mode=CONSUMER`)).statusCode).toBe(
      404,
    );
  });
  it('rejects invalid filters, exposes no write endpoint, and never caches catalog responses', async () => {
    for (const query of [
      'page=0',
      'pageSize=101',
      'mode=OTHER',
      'minPriceMinor=1.5',
      'maxPriceMinor=9223372036854775808',
      'priceUnit=USD',
      'sort=unknown',
    ])
      expect((await get(`?${query}`)).statusCode).toBe(400);
    expect(
      (await app.inject({ method: 'POST', url: '/catalog/boxes', payload: {} }))
        .statusCode,
    ).toBe(404);
    expect((await get('')).headers['cache-control']).toBe('no-store');
  });
});
