import { z } from 'zod';
import { MAX_MINOR } from '@box/money';
const minor = z
  .string()
  .refine((v) => /^\d{1,19}$/.test(v) && BigInt(v) <= MAX_MINOR);
const positiveInteger = (maximum: number, fallback: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(maximum))
    .prefault(String(fallback));
export const catalogQuerySchema = z
  .object({
    mode: z.enum(['CONSUMER', 'COIN']).default('CONSUMER'),
    search: z.string().trim().max(120).default(''),
    minPriceMinor: minor.default('0'),
    maxPriceMinor: minor.optional(),
    category: z.string().trim().min(1).max(64).optional(),
    tag: z.enum(['new', 'hot']).optional(),
    sort: z.enum(['default', 'low', 'high', 'name']).default('default'),
    page: positiveInteger(1000000, 1),
    pageSize: positiveInteger(100, 60),
  })
  .strict();
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export const catalogDetailQuerySchema = z
  .object({ mode: z.enum(['CONSUMER', 'COIN']).default('CONSUMER') })
  .strict();
