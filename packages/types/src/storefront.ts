import type { CatalogMode } from './index.js';

/** Public read contract v1; references are resolved by Catalog using mode + slug. */
export interface StorefrontHome {
  featuredBoxes: { mode: CatalogMode; slug: string }[];
  hotBoxes: { mode: CatalogMode; slug: string }[];
  banners: { id: string; image: string; alt: string; href: string }[];
  featuredCompetitionId: string | null;
}
