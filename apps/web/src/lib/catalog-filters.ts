import { decimalToMinor } from '@box/money';
export interface Filters {
  search: string;
  min: string;
  max: string;
  sort: string;
  category: boolean;
  tag: string;
  page: number;
}
export const defaultFilters: Filters = {
  search: '',
  min: '0',
  max: '10000',
  sort: '',
  category: false,
  tag: '',
  page: 1,
};
export function filterQuery(filters: Filters): string {
  const params = new URLSearchParams({
    mode: 'CONSUMER',
    search: filters.search.trim(),
    minPriceMinor: decimalToMinor(filters.min || '0', 'USD').toString(),
    maxPriceMinor: decimalToMinor(filters.max || '10000', 'USD').toString(),
    sort: filters.sort || 'default',
    page: String(filters.page),
    pageSize: '60',
  });
  if (filters.category) params.set('category', 'collectibles');
  if (filters.tag) params.set('tag', filters.tag);
  return params.toString();
}
