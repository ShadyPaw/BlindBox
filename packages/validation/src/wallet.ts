import { z } from 'zod';

const identifier = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9:_-]+$/);
const minor = z.string().refine(
  // Zod may run refinements after another check fails. Guard BigInt in this
  // same predicate so malformed external input is a validation error, never a throw.
  (value) =>
    /^(0|[1-9]\d{0,18})$/.test(value) && BigInt(value) <= 9223372036854775807n,
  'Expected integer minor units within BIGINT range',
);

/** Internal commands only. Never accept these from an unauthenticated payment/browser request. */
export const walletPostingSchema = z
  .object({
    userId: identifier,
    unit: z.enum(['USD', 'COIN']),
    amountMinor: minor.refine(
      (value) => value !== '0',
      'Amount must be positive',
    ),
    idempotencyKey: identifier,
    referenceType: z
      .string()
      .min(1)
      .max(40)
      .regex(/^[A-Z][A-Z0-9_]*$/),
    referenceId: identifier,
    description: z.string().trim().min(1).max(200),
  })
  .strict();
export type WalletPosting = z.infer<typeof walletPostingSchema>;

export const walletTransactionsQuerySchema = z
  .object({
    unit: z.enum(['USD', 'COIN']).default('USD'),
    direction: z.enum(['CREDIT', 'DEBIT']).optional(),
    cursor: minor.refine((value) => value !== '0').optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type WalletTransactionsQuery = z.infer<
  typeof walletTransactionsQuerySchema
>;
