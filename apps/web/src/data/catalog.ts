import reference from './reference.json';
import details from './details.json';
import coinReference from './coin-boxes.json';

export const boxes = reference.catalog;
export type Box = (typeof boxes)[number] & { currency?: string };
export const coinBoxes: Box[] = coinReference;
export const prizes = reference.prizes;
export function boxPrizes(slug: string): typeof prizes | undefined {
  if (slug === 'everyday-sync') return prizes;
  return (details as Record<string, typeof prizes>)[slug];
}
export const art = (index: number) => reference.art[index] ?? '';
export const extraArt = reference.extras;
export const money = (value: number) => `$${value.toFixed(2)}`;
export const boxHref = (box: Box) =>
  `/${box.currency === 'coins' ? 'coin-boxes' : 'boxes'}/${box.slug}`;
export const boxPrice = (box: Box, quantity = 1) =>
  box.currency === 'coins'
    ? `★ ${(box.price * quantity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : money(box.price * quantity);

export interface Filters {
  search: string;
  min: number;
  max: number;
  sort: string;
  category: boolean;
  tag: string;
}
export function filterBoxes(filters: Filters): Box[] {
  return boxes
    .filter(
      (box) =>
        box.name.toLowerCase().includes(filters.search.trim().toLowerCase()) &&
        box.price >= filters.min &&
        box.price <= filters.max &&
        (!filters.category || box.collectible) &&
        (!filters.tag || box.badge === filters.tag),
    )
    .sort((a, b) =>
      filters.sort === 'low'
        ? a.price - b.price
        : filters.sort === 'high'
          ? b.price - a.price
          : filters.sort === 'name'
            ? a.name.localeCompare(b.name)
            : 0,
    );
}
