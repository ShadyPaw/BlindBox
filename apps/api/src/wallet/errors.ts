export type WalletErrorCode =
  | 'INVALID_POSTING'
  | 'USER_NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REFERENCE_CONFLICT'
  | 'INSUFFICIENT_FUNDS'
  | 'AMOUNT_OVERFLOW';

/** Business failures are distinct from infrastructure errors; callers must roll back either. */
export class WalletError extends Error {
  constructor(public readonly code: WalletErrorCode) {
    super(code);
    this.name = 'WalletError';
  }
}

export function translatePostingError(error: unknown): never {
  if (error instanceof WalletError) throw error;
  // Prisma adapters wrap PostgreSQL trigger errors in metadata. Only map known markers;
  // never expose raw SQL/connection errors to an HTTP caller.
  const details =
    error instanceof Error
      ? `${error.message} ${JSON.stringify('meta' in error ? error.meta : {})}`
      : '';
  if (details.includes('WALLET_INSUFFICIENT_FUNDS'))
    throw new WalletError('INSUFFICIENT_FUNDS');
  if (details.includes('WALLET_OVERFLOW'))
    throw new WalletError('AMOUNT_OVERFLOW');
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
    throw new WalletError('REFERENCE_CONFLICT');
  throw error;
}
