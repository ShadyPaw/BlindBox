import type { MoneyUnit } from './index.js';

/** Real ledger response. Intentionally separate from the payment UI prototype contracts. */
export interface WalletBalancesResponse {
  balances: { unit: MoneyUnit; availableMinor: string }[];
}
export interface WalletLedgerRecord {
  id: string;
  unit: MoneyUnit;
  direction: 'CREDIT' | 'DEBIT';
  amountMinor: string;
  balanceAfterMinor: string;
  referenceType: string;
  referenceId: string;
  description: string;
  createdAt: string;
}
export interface WalletTransactionsResponse {
  transactions: WalletLedgerRecord[];
  nextCursor: string | null;
}
