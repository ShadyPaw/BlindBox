import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export function createDatabase(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    connectionTimeoutMillis: 2000,
    query_timeout: 2000,
    max: 10,
  });
  return new PrismaClient({ adapter });
}
export type Database = ReturnType<typeof createDatabase>;
export type { Prisma } from './generated/prisma/client.js';
