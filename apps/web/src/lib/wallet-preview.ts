import { decimalToMinor, parseMinor } from '@box/money';
import type { RechargeOrder, WalletGateway } from '@box/types';

export type PreviewOutcome = 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type PreviewScenario = 'normal' | 'empty' | 'unavailable';
export const previewMethods = [
  { id: 'preview-card', name: '銀行卡', description: '卡片付款流程預覽' },
  { id: 'preview-wallet', name: '電子錢包', description: '錢包付款流程預覽' },
] as const;

/** Prototype limits only; the future server must supply and enforce channel limits. */
export function rechargeAmount(text: string): string {
  const minor = decimalToMinor(text, 'USD');
  if (minor < 500n || minor > 100000n)
    throw new Error('請輸入 $5.00–$1,000.00，最多兩位小數。');
  return minor.toString();
}

function delay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, 350);
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Explicit preview adapter, NEVER a fallback for a failed production request.
 * Each instance owns its fake orders; nothing is persisted or credited to an account.
 */
export function createWalletPreview(
  scenario: PreviewScenario = 'normal',
  outcome: PreviewOutcome = 'SUCCEEDED',
): WalletGateway {
  const orders = new Map<string, RechargeOrder>();
  async function read(signal: AbortSignal) {
    await delay(signal);
    if (scenario === 'unavailable')
      throw new Error('錢包服務暫時無法使用，請稍後重試。');
  }
  return {
    async getBalances(signal) {
      await read(signal);
      return [
        {
          unit: 'USD',
          availableMinor: scenario === 'empty' ? '0' : '12850',
          frozenMinor: '0',
        },
        {
          unit: 'COIN',
          availableMinor: scenario === 'empty' ? '0' : '500',
          frozenMinor: '0',
        },
      ];
    },
    async getTransactions(signal) {
      await read(signal);
      if (scenario === 'empty') return [];
      return [
        {
          id: 'DEMO-003',
          unit: 'USD',
          amountMinor: '2150',
          direction: 'DEBIT',
          description: '消費示例',
          createdAt: '2026-09-18T09:30:00Z',
        },
        {
          id: 'DEMO-002',
          unit: 'COIN',
          amountMinor: '500',
          direction: 'CREDIT',
          description: '獎勵示例',
          createdAt: '2026-09-18T09:00:00Z',
        },
        {
          id: 'DEMO-001',
          unit: 'USD',
          amountMinor: '15000',
          direction: 'CREDIT',
          description: '充值示例',
          createdAt: '2026-09-18T08:30:00Z',
        },
      ];
    },
    async createRecharge(input, signal) {
      await read(signal);
      const amount = parseMinor(input.amountMinor);
      if (
        input.unit !== 'USD' ||
        amount < 500n ||
        amount > 100000n ||
        !previewMethods.some((method) => method.id === input.methodId)
      )
        throw new Error('充值資料無效');
      const order: RechargeOrder = {
        ...input,
        id: `DEMO-${crypto.randomUUID()}`,
        status: 'PENDING',
      };
      orders.set(order.id, order);
      return { ...order };
    },
    async getRecharge(id, signal) {
      await read(signal);
      const order = orders.get(id);
      if (!order) throw new Error('找不到此演示訂單，請重新開始。');
      const result = { ...order, status: outcome };
      orders.set(id, result);
      return { ...result };
    },
  };
}
