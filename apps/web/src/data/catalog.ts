import decorations from './decorations.json';
import {
  decimalToMinor,
  formatMoney,
  multiplyMinor,
  parseMinor,
} from '@box/money';
import type { CatalogBox } from '@box/types';
export type Box = CatalogBox;
export const art = (index: number) => decorations.art[index] ?? '';
export const extraArt = decorations.extras;
// Non-catalog leaderboard/feed amounts are static reference text.
export const money = (value: string) =>
  formatMoney(decimalToMinor(value, 'USD'), 'USD');
export const boxHref = (box: Box) =>
  `/${box.mode === 'COIN' ? 'coin-boxes' : 'boxes'}/${box.slug}`;
export const boxPrice = (box: Box, quantity = 1) =>
  formatMoney(
    multiplyMinor(parseMinor(box.priceMinor), BigInt(quantity)),
    box.priceUnit,
  );
