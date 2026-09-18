import { describe, expect, it } from 'vitest';
import snapshot from '../../packages/database/seed/catalog.snapshot.json';
import { decimalToMinor } from '@box/money';
import { catalogQuerySchema } from '@box/validation';
import { catalogOrder } from '../../apps/api/src/catalog/service.js';
import {
  defaultFilters,
  filterQuery,
} from '../../apps/web/src/lib/catalog-filters';
describe('catalog contracts and source snapshot', () => {
  it('keeps stable unique identifiers and exact nonnegative source prices', () => {
    const cash = snapshot.filter((box) => box.mode === 'CONSUMER');
    expect(cash).toHaveLength(36);
    expect(snapshot.filter((box) => box.mode === 'COIN')).toHaveLength(18);
    expect(new Set(snapshot.map((box) => `${box.mode}:${box.slug}`)).size).toBe(
      54,
    );
    expect(new Set(snapshot.map((box) => box.sourceKey)).size).toBe(54);
    const items = snapshot.flatMap((box) => box.items);
    expect(new Set(items.map((item) => item.sourceKey)).size).toBe(
      items.length,
    );
    for (const box of snapshot)
      expect(
        decimalToMinor(box.price, box.mode === 'COIN' ? 'COIN' : 'USD'),
      ).toBeGreaterThanOrEqual(0n);
    expect(
      snapshot.filter((box) => box.completenessStatus === 'COMPLETE'),
    ).toHaveLength(4);
  });
  it('normalizes search and converts UI price filters into exact minor units', () => {
    const parsed = catalogQuerySchema.parse({
      search: '  CHARIZARD ',
      maxPriceMinor: '200',
    });
    expect(parsed).toMatchObject({
      search: 'CHARIZARD',
      maxPriceMinor: '200',
      mode: 'CONSUMER',
      page: 1,
      pageSize: 60,
    });
    const params = new URLSearchParams(
      filterQuery({
        ...defaultFilters,
        min: '0.29',
        max: '6.99',
        category: true,
      }),
    );
    expect(params.get('minPriceMinor')).toBe('29');
    expect(params.get('maxPriceMinor')).toBe('699');
    expect(params.get('category')).toBe('collectibles');
    expect(
      catalogQuerySchema.safeParse({
        minPriceMinor: '2000',
        maxPriceMinor: '100',
      }).success,
    ).toBe(true);
  });
  it('uses deterministic order without mutating the snapshot', () => {
    expect(catalogOrder('low')).toEqual([{ priceMinor: 'asc' }, { id: 'asc' }]);
    expect(catalogOrder('high')).toEqual([
      { priceMinor: 'desc' },
      { id: 'asc' },
    ]);
    expect(catalogOrder('name')).toEqual([{ name: 'asc' }, { id: 'asc' }]);
    expect(catalogOrder('default')).toEqual([
      { displayOrder: 'asc' },
      { id: 'asc' },
    ]);
    expect(snapshot[0]!.slug).toBe('everyday-sync');
    for (const query of [
      { minPriceMinor: '1.1' },
      { page: '-1' },
      { pageSize: '101' },
      { minPriceMinor: 'invalid' },
    ])
      expect(catalogQuerySchema.safeParse(query).success).toBe(false);
  });
});
