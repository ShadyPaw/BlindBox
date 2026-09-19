/** Draft UI contracts. No wallet or payment HTTP endpoints exist yet. */
export interface WalletBalance {
  unit: 'USD' | 'COIN';
  availableMinor: string;
  frozenMinor: string;
}
export interface WalletTransaction {
  id: string;
  unit: WalletBalance['unit'];
  amountMinor: string;
  direction: 'CREDIT' | 'DEBIT';
  description: string;
  createdAt: string;
}
export interface RechargeRequest {
  amountMinor: string;
  unit: 'USD';
  methodId: string;
}
export interface RechargeOrder extends RechargeRequest {
  id: string;
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
}
/** Implement with authenticated, validated HTTP requests when the backend is ready. */
export interface WalletGateway {
  getBalances(signal: AbortSignal): Promise<WalletBalance[]>;
  getTransactions(signal: AbortSignal): Promise<WalletTransaction[]>;
  createRecharge(
    input: RechargeRequest,
    signal: AbortSignal,
  ): Promise<RechargeOrder>;
  getRecharge(id: string, signal: AbortSignal): Promise<RechargeOrder>;
}
