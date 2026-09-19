import { describe, expect, it } from 'vitest';
import {
  createWalletPreview,
  rechargeAmount,
} from '../../apps/web/src/lib/wallet-preview';

describe('wallet prototype boundary', () => {
  it('parses exact USD amounts and rejects invalid or out-of-range input', () => {
    expect(rechargeAmount('25.01')).toBe('2501');
    expect(rechargeAmount('1000')).toBe('100000');
    for (const input of ['', '-10', '4.99', '1000.01', '5.001', '1e2', 'NaN'])
      expect(() => rechargeAmount(input)).toThrow();
  });
  it('never credits a balance when a preview order succeeds', async () => {
    const gateway = createWalletPreview();
    const signal = new AbortController().signal;
    const before = await gateway.getBalances(signal);
    const order = await gateway.createRecharge(
      { amountMinor: '2500', unit: 'USD', methodId: 'preview-card' },
      signal,
    );
    expect(order.status).toBe('PENDING');
    expect((await gateway.getRecharge(order.id, signal)).status).toBe(
      'SUCCEEDED',
    );
    expect(await gateway.getBalances(signal)).toEqual(before);
    await expect(
      createWalletPreview().getRecharge(order.id, signal),
    ).rejects.toThrow('找不到');
  });
  it('supports cancellation and surfaces unavailability without fake fallback data', async () => {
    const controller = new AbortController();
    const pending = createWalletPreview().getBalances(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      createWalletPreview('unavailable').getBalances(
        new AbortController().signal,
      ),
    ).rejects.toThrow('暫時無法使用');
  });
});
