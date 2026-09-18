import { randomUUID } from 'node:crypto';
import { decimalToMinor, type MoneyUnit } from '@box/money';
import type { Database } from './index.js';

export interface CatalogSeedItem {
  sourceKey: string;
  name: string;
  image: string;
  displayOrder: number;
  displayValue: string;
  displayValueUnit: MoneyUnit;
  /** Reference display only; this importer does not create draw configuration. */
  displayProbabilityPercent: string | null;
}
export interface CatalogSeedBox {
  sourceKey: string;
  slug: string;
  name: string;
  description: string | null;
  image: string;
  mode: 'CONSUMER' | 'COIN';
  category: string;
  tags: string[];
  displayOrder: number;
  publicationStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  completenessStatus: 'COMPLETE' | 'INCOMPLETE';
  price: string;
  priceUnit: MoneyUnit;
  items: CatalogSeedItem[];
}

/** Explicit bootstrap only. Never invoke from migrations or application startup. */
export async function seedCatalog(db: Database, boxes: CatalogSeedBox[]) {
  return db.$transaction(
    async (tx) => {
      const counts = {
        insertedBoxes: 0,
        skippedBoxes: 0,
        insertedItems: 0,
        skippedItems: 0,
      };
      for (const box of boxes) {
        const priceMinor = decimalToMinor(box.price, box.priceUnit);
        if (!box.sourceKey || !box.slug)
          throw new Error('Missing stable box identifier');
        // Target only sourceKey conflicts. A conflicting slug or bad FK must abort the whole import.
        const inserted = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "CatalogBox" (
          "id", "sourceKey", "slug", "name", "description", "image",
          "mode", "category", "tags", "displayOrder", "publicationStatus",
          "completenessStatus", "priceMinor", "priceUnit", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${box.sourceKey}, ${box.slug}, ${box.name}, ${box.description}, ${box.image},
          ${box.mode}::"CatalogMode", ${box.category}, ${box.tags}::text[], ${box.displayOrder},
          ${box.publicationStatus}::"PublicationStatus", ${box.completenessStatus}::"CompletenessStatus",
          ${priceMinor}, ${box.priceUnit}::"MoneyUnit", CURRENT_TIMESTAMP
        )
        ON CONFLICT ("sourceKey") DO NOTHING RETURNING "id"`;
        counts[inserted.length ? 'insertedBoxes' : 'skippedBoxes']++;
        const parent =
          inserted[0] ??
          (await tx.catalogBox.findUniqueOrThrow({
            where: { sourceKey: box.sourceKey },
            select: { id: true },
          }));
        for (const item of box.items) {
          if (!item.sourceKey)
            throw new Error('Missing stable item identifier');
          // Preserve missing values and the source percentage. Never normalize or total probabilities.
          if (
            item.displayProbabilityPercent !== null &&
            !/^\d{1,8}(?:\.\d{1,12})?$/.test(item.displayProbabilityPercent)
          )
            throw new Error('Invalid display percentage precision');
          const value = decimalToMinor(
            item.displayValue,
            item.displayValueUnit,
          );
          const result = await tx.$queryRaw<{ id: string }[]>`
          INSERT INTO "CatalogBoxItem" (
            "id", "sourceKey", "boxId", "name", "image", "displayOrder",
            "displayValueMinor", "displayValueUnit", "displayProbabilityPercent", "updatedAt"
          ) VALUES (
            ${randomUUID()}, ${item.sourceKey}, ${parent.id}, ${item.name}, ${item.image}, ${item.displayOrder},
            ${value}, ${item.displayValueUnit}::"MoneyUnit", ${item.displayProbabilityPercent}::numeric, CURRENT_TIMESTAMP
          )
          ON CONFLICT ("sourceKey") DO NOTHING RETURNING "id"`;
          counts[result.length ? 'insertedItems' : 'skippedItems']++;
        }
      }
      return counts;
    },
    { timeout: 60000 },
  );
}
