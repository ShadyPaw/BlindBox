import type { Database } from '@box/database';
import type { StorefrontHome } from '@box/types';
import { catalogOrder } from '../catalog/service.js';

/** Homepage placement is editorial ordering, never a sales ranking or draw configuration. */
export class StorefrontQueryService {
  constructor(private readonly db: Database) {}

  async home(): Promise<StorefrontHome> {
    return this.db.$transaction(
      async (tx) => {
        const where = {
          publicationStatus: 'PUBLISHED' as const,
          mode: 'CONSUMER' as const,
          priceUnit: 'USD' as const,
        };
        const select = { mode: true, slug: true } as const;
        const orderBy = catalogOrder('default');
        const featuredBoxes = await tx.catalogBox.findMany({
          where,
          select,
          orderBy,
          take: 6,
        });
        const hot = await tx.catalogBox.findMany({
          where: { ...where, tags: { has: 'hot' } },
          select,
          orderBy,
          take: 6,
        });
        const remaining =
          hot.length < 6
            ? await tx.catalogBox.findMany({
                where: { ...where, NOT: { tags: { has: 'hot' } } },
                select,
                orderBy,
                take: 6 - hot.length,
              })
            : [];
        return {
          featuredBoxes,
          hotBoxes: [...hot, ...remaining],
          banners: [],
          featuredCompetitionId: null,
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
