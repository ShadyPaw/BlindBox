import type { Database, Prisma } from '@box/database';
import type {
  WalletBalancesResponse,
  WalletTransactionsResponse,
} from '@box/types';
import type { WalletTransactionsQuery } from '@box/validation';
import { ledgerRecord } from './ledger-service.js';

export class WalletQueryService {
  constructor(private readonly db: Database) {}

  async balances(userId: string): Promise<WalletBalancesResponse> {
    const accounts = await this.db.walletAccount.findMany({
      where: { userId, kind: 'USER' },
    });
    return {
      balances: (['USD', 'COIN'] as const).map((unit) => ({
        unit,
        availableMinor: (
          accounts.find((account) => account.unit === unit)?.balanceMinor ?? 0n
        ).toString(),
      })),
    };
  }

  async transactions(
    userId: string,
    query: WalletTransactionsQuery,
  ): Promise<WalletTransactionsResponse> {
    const where: Prisma.WalletTransferWhereInput = {
      unit: query.unit,
      ...(query.direction ? { direction: query.direction } : {}),
      ...(query.cursor ? { sequence: { lt: BigInt(query.cursor) } } : {}),
      OR: [
        { fromAccount: { userId, kind: 'USER' } },
        { toAccount: { userId, kind: 'USER' } },
      ],
    };
    const rows = await this.db.walletTransfer.findMany({
      where,
      orderBy: { sequence: 'desc' },
      take: query.pageSize + 1,
    });
    const page = rows.slice(0, query.pageSize);
    return {
      transactions: page.map(ledgerRecord),
      nextCursor:
        rows.length > query.pageSize ? page.at(-1)!.sequence.toString() : null,
    };
  }

  /** Read-only audit, one MVCC snapshot. SUM uses PostgreSQL's wider aggregate accumulator;
   * all stored and posted amounts remain integer BIGINT. Never automatically repair money.
   */
  reconcile() {
    return this.db.$queryRaw<
      { accountId: string; storedMinor: string; ledgerMinor: string }[]
    >`
      WITH movements AS (
        SELECT "fromAccountId" AS id, -"amountMinor" AS amount FROM "WalletTransfer"
        UNION ALL
        SELECT "toAccountId" AS id, "amountMinor" AS amount FROM "WalletTransfer"
      ), totals AS (SELECT id, SUM(amount) AS amount FROM movements GROUP BY id)
      SELECT a.id AS "accountId", a."balanceMinor"::text AS "storedMinor",
        COALESCE(t.amount, 0)::text AS "ledgerMinor"
      FROM "WalletAccount" a LEFT JOIN totals t ON a.id = t.id
      WHERE a."balanceMinor" <> COALESCE(t.amount, 0)
      ORDER BY a.id`;
  }
}
