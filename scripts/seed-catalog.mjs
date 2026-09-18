import { readFile } from 'node:fs/promises';
import { config } from 'dotenv';
import { createDatabase } from '../packages/database/dist/index.js';
import { seedCatalog } from '../packages/database/dist/seed-catalog.js';

config({ path: new URL('../.env', import.meta.url), quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const snapshot = JSON.parse(
  await readFile(
    new URL('../packages/database/seed/catalog.snapshot.json', import.meta.url),
    'utf8',
  ),
);
const db = createDatabase(process.env.DATABASE_URL);
try {
  const result = await seedCatalog(db, snapshot);
  console.log(
    `Inserted boxes: ${result.insertedBoxes}\nSkipped boxes: ${result.skippedBoxes}\nInserted items: ${result.insertedItems}\nSkipped items: ${result.skippedItems}`,
  );
} finally {
  await db.$disconnect();
}
