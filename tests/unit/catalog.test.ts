import { describe, expect, it } from 'vitest';
import { boxes, filterBoxes } from '../../apps/web/src/data/catalog';
const defaults = {
  search: '',
  min: 0,
  max: 10000,
  sort: '',
  category: false,
  tag: '',
};
describe('storefront catalog', () => {
  it('keeps stable unique URLs and finite nonnegative prices', () => {
    expect(new Set(boxes.map((box) => box.slug)).size).toBe(36);
    expect(
      boxes.every((box) => Number.isFinite(box.price) && box.price >= 0),
    ).toBe(true);
  });
  it('combines price and case-insensitive search filters', () => {
    expect(
      filterBoxes({ ...defaults, search: '  CHARIZARD ', max: 2 }).map(
        (box) => box.name,
      ),
    ).toEqual(['Charizard Across Eras']);
    expect(filterBoxes({ ...defaults, min: 20, max: 1 })).toEqual([]);
  });
  it('sorts without mutating source order', () => {
    expect(filterBoxes({ ...defaults, sort: 'low' })[0]?.name).toBe(
      'One Piece Voyage',
    );
    expect(boxes[0]?.name).toBe('Everyday Sync');
    expect(
      filterBoxes({ ...defaults, category: true }).every(
        (box) => box.collectible,
      ),
    ).toBe(true);
  });
});
