import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import type { CatalogDetail, CatalogList, CatalogMode } from '@box/types';
import { apiOrigin } from './auth-server';
async function catalogFetch<T>(
  path: string,
  missingIsNotFound = false,
): Promise<T> {
  // Explicit request boundary: build never depends on a live API or database.
  await connection();
  let response: Response;
  try {
    response = await fetch(`${apiOrigin()}/catalog/boxes${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error('Catalog service unavailable');
  }
  if (response.status === 404 && missingIsNotFound) notFound();
  if (!response.ok) throw new Error('Catalog service unavailable');
  return response.json() as Promise<T>;
}
export const loadCatalog = (mode: CatalogMode = 'CONSUMER', page = 1) =>
  catalogFetch<CatalogList>(`?mode=${mode}&page=${page}`);
export const loadCatalogDetail = (
  slug: string,
  mode: CatalogMode = 'CONSUMER',
) =>
  catalogFetch<CatalogDetail>(
    `/${encodeURIComponent(slug)}?mode=${mode}`,
    true,
  );
