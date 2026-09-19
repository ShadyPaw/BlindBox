import { createHash, randomUUID } from 'node:crypto';
import type { Database, Prisma } from '@box/database';
import { walletPostingSchema, type WalletPosting } from '@box/validation';
import type { WalletLedgerRecord } from '@box/types';
import { WalletError, translatePostingError } from './errors.js';
import { createLogger } from '@box/logger';

type Direction = 'CREDIT' | 'DEBIT';
export type StoredTransfer = Prisma.WalletTransferGetPayload<object>;
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const walletAccountId = (userId: string, unit: string) =>
  `user:${hash(`${userId}:${unit}`)}`;

export function ledgerRecord(row: StoredTransfer): WalletLedgerRecord {
  return {
    id: row.id,
    unit: row.unit,
    direction: row.direction,
    amountMinor: row.amountMinor.toString(),
    balanceAfterMinor: (row.direction === 'CREDIT'
      ? row.toBalanceAfterMinor
      : row.fromBalanceAfterMinor
    ).toString(),
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
  };
}

export class WalletLedgerService {
  constructor(private readonly db: Database) {}

  credit(input: WalletPosting) {
    return this.post('CREDIT', input);
  }
  debit(input: WalletPosting) {
    return this.post('DEBIT', input);
  }

  /** Phase 5 uses the caller's transaction: debit and outcome commit or roll back together.
   * Propagate all errors out of that transaction. Do not catch a failed SQL command and commit.
   * For multi-posting transactions, callers must use a consistent ordering of business keys.
   */
  creditInTransaction(tx: Prisma.TransactionClient, input: WalletPosting) {
    return this.postInTransaction(tx, 'CREDIT', input);
  }
  debitInTransaction(tx: Prisma.TransactionClient, input: WalletPosting) {
    return this.postInTransaction(tx, 'DEBIT', input);
  }

  private async post(direction: Direction, input: WalletPosting) {
    try {
      const result = await this.db.$transaction(
        (tx) => this.postInTransaction(tx, direction, input),
        {
          isolationLevel: 'ReadCommitted',
          maxWait: 5000,
          timeout: 10000,
        },
      );
      createLogger('wallet').info(
        {
          event: 'wallet.post.confirmed',
          transferId: result.id,
          unit: result.unit,
          direction: result.direction,
        },
        'Wallet posting confirmed (possibly replayed)',
      );
      return result;
    } catch (error) {
      return translatePostingError(error);
    }
  }

  private async postInTransaction(
    tx: Prisma.TransactionClient,
    direction: Direction,
    raw: WalletPosting,
  ): Promise<WalletLedgerRecord> {
    const parsed = walletPostingSchema.safeParse(raw);
    if (!parsed.success) throw new WalletError('INVALID_POSTING');
    const input = parsed.data;
    const requestHash = hash(
      JSON.stringify([
        direction,
        input.userId,
        input.unit,
        input.amountMinor,
        input.referenceType,
        input.referenceId,
        input.description,
      ]),
    );
    try {
      // Serialize identical request keys across ALL callers/users. Hash collisions only delay
      // unrelated keys; the exact key and payload hash remain the source of truth.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`wallet:${input.idempotencyKey}`}, 0))`;
      const existing = await tx.walletTransfer.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          throw new WalletError('IDEMPOTENCY_CONFLICT');
        return ledgerRecord(existing);
      }
      if (
        !(await tx.user.findUnique({
          where: { id: input.userId },
          select: { id: true },
        }))
      )
        throw new WalletError('USER_NOT_FOUND');
      const referenced = await tx.walletTransfer.findUnique({
        where: {
          referenceType_referenceId_direction: {
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            direction,
          },
        },
      });
      if (referenced) throw new WalletError('REFERENCE_CONFLICT');

      const userAccount = walletAccountId(input.userId, input.unit);
      const clearingAccount = `clearing:${input.unit}`;
      // Lazy, zero-only creation supports pre-existing users without altering registration.
      // Establish the clearing account first, in the same order for every operation.
      await tx.$executeRaw`INSERT INTO "WalletAccount" ("id", "kind", "unit")
        VALUES (${clearingAccount}, 'CLEARING', ${input.unit}::"MoneyUnit") ON CONFLICT DO NOTHING`;
      await tx.$executeRaw`INSERT INTO "WalletAccount" ("id", "kind", "userId", "unit")
        VALUES (${userAccount}, 'USER', ${input.userId}, ${input.unit}::"MoneyUnit") ON CONFLICT DO NOTHING`;
      const row = await tx.walletTransfer.create({
        data: {
          id: randomUUID(),
          idempotencyKey: input.idempotencyKey,
          requestHash,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          direction,
          description: input.description,
          unit: input.unit,
          amountMinor: BigInt(input.amountMinor),
          fromAccountId: direction === 'CREDIT' ? clearingAccount : userAccount,
          toAccountId: direction === 'CREDIT' ? userAccount : clearingAccount,
        },
      });
      // Database trigger owns BOTH balance updates and immutable post-balance snapshots.
      // A uniqueness failure or any later error rolls back every effect of this insert.
      return ledgerRecord(row);
    } catch (error) {
      return translatePostingError(error);
    }
  }
}
