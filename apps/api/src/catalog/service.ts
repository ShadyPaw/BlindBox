import { NotFoundException } from '@nestjs/common';
import type { Database, Prisma } from '@box/database';
import { minorToDecimal } from '@box/money';
import type {
  CatalogBox,
  CatalogBoxItem,
  CatalogDetail,
  CatalogList,
} from '@box/types';
import type { CatalogQuery } from '@box/validation';

type StoredBox = Prisma.CatalogBoxGetPayload<object>;
type StoredItem = Prisma.CatalogBoxItemGetPayload<object>;
export function boxResponse(box: StoredBox): CatalogBox {
  return {
    id: box.id,
    slug: box.slug,
    name: box.name,
    description: box.description,
    image: box.image,
    mode: box.mode,
    category: box.category,
    tags: box.tags,
    displayOrder: box.displayOrder,
    completenessStatus: box.completenessStatus,
    priceMinor: box.priceMinor.toString(),
    price: minorToDecimal(box.priceMinor, box.priceUnit),
    priceUnit: box.priceUnit,
  };
}
export function itemResponse(item: StoredItem): CatalogBoxItem {
  return {
    id: item.id,
    name: item.name,
    image: item.image,
    displayOrder: item.displayOrder,
    displayValueMinor: item.displayValueMinor.toString(),
    displayValue: minorToDecimal(item.displayValueMinor, item.displayValueUnit),
    displayValueUnit: item.displayValueUnit,
    // This percentage is a source display value, NEVER a draw weight or outcome input.
    displayProbabilityPercent:
      item.displayProbabilityPercent?.toFixed() ?? null,
  };
}
export function catalogOrder(
  sort: CatalogQuery['sort'],
): Prisma.CatalogBoxOrderByWithRelationInput[] {
  switch (sort) {
    case 'low':
      return [{ priceMinor: 'asc' }, { id: 'asc' }];
    case 'high':
      return [{ priceMinor: 'desc' }, { id: 'asc' }];
    case 'name':
      return [{ name: 'asc' }, { id: 'asc' }];
    default:
      return [{ displayOrder: 'asc' }, { id: 'asc' }];
  }
}
export class CatalogQueryService {
  constructor(private readonly db: Database) {}
  async list(query: CatalogQuery): Promise<CatalogList> {
    const where: Prisma.CatalogBoxWhereInput = {
      publicationStatus: 'PUBLISHED',
      mode: query.mode,
      priceUnit: query.mode === 'COIN' ? 'COIN' : 'USD',
      name: { contains: query.search, mode: 'insensitive' },
      priceMinor: {
        gte: BigInt(query.minPriceMinor),
        ...(query.maxPriceMinor === undefined
          ? {}
          : { lte: BigInt(query.maxPriceMinor) }),
      },
      ...(query.category ? { category: query.category } : {}),
      ...(query.tag ? { tags: { has: query.tag } } : {}),
    };
    const [boxes, total] = await this.db.$transaction(
      [
        this.db.catalogBox.findMany({
          where,
          orderBy: catalogOrder(query.sort),
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.catalogBox.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
    return {
      boxes: boxes.map(boxResponse),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
  async detail(
    slug: string,
    mode: CatalogBox['mode'] = 'CONSUMER',
  ): Promise<CatalogDetail> {
    return this.db.$transaction(
      async (tx) => {
        const box = await tx.catalogBox.findFirst({
          where: { slug, mode, publicationStatus: 'PUBLISHED' },
          include: {
            items: { orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }] },
          },
        });
        if (!box) throw new NotFoundException('Catalog box not found');
        const base = {
          publicationStatus: 'PUBLISHED' as const,
          mode: box.mode,
          id: { not: box.id },
        };
        const preferred = await tx.catalogBox.findMany({
          where: { ...base, category: box.category },
          orderBy: catalogOrder('default'),
          take: 6,
        });
        const remaining =
          preferred.length < 6
            ? await tx.catalogBox.findMany({
                where: { ...base, category: { not: box.category } },
                orderBy: catalogOrder('default'),
                take: 6 - preferred.length,
              })
            : [];
        return {
          box: boxResponse(box),
          items: box.items.map(itemResponse),
          relatedBoxes: [...preferred, ...remaining].map(boxResponse),
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
