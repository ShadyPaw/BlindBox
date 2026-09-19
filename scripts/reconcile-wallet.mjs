import { config } from 'dotenv';
import { createDatabase } from '../packages/database/dist/index.js';
import { WalletQueryService } from '../apps/api/dist/wallet/query-service.js';
config({ path: '.env', quiet: true });
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const db = createDatabase(process.env.DATABASE_URL);
try {
  const mismatches = await new WalletQueryService(db).reconcile();
  console.log(
    JSON.stringify({ event: 'wallet.reconciliation', mismatches }, null, 2),
  );
  if (mismatches.length) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
