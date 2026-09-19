'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatMoney, parseMinor } from '@box/money';
import type { WalletBalance, WalletTransaction } from '@box/types';
import {
  createWalletPreview,
  type PreviewScenario,
} from '../lib/wallet-preview';
import { RechargeDialog } from './recharge-dialog';
import { Modal } from './site-shell';

type WalletData = {
  balances: WalletBalance[];
  transactions: WalletTransaction[];
};
type ViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: WalletData };

export function WalletView() {
  const [unit, setUnit] = useState<'USD' | 'COIN'>('USD');
  const [direction, setDirection] = useState('ALL');
  const [scenario, setScenario] = useState<PreviewScenario>('normal');
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ViewState>({ status: 'loading' });
  const [recharge, setRecharge] = useState(false);
  const [detail, setDetail] = useState<WalletTransaction | null>(null);
  const version = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++version.current;
    const gateway = createWalletPreview(scenario);
    setState({ status: 'loading' });
    // Cancellation plus version guards protect both data and errors during fast retries.
    Promise.all([
      gateway.getBalances(controller.signal),
      gateway.getTransactions(controller.signal),
    ])
      .then(([balances, transactions]) => {
        if (!controller.signal.aborted && current === version.current)
          setState({ status: 'ready', data: { balances, transactions } });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted && current === version.current)
          setState({
            status: 'error',
            message:
              error instanceof Error ? error.message : '錢包服務暫時無法使用',
          });
      });
    return () => controller.abort();
  }, [scenario, attempt]);
  const balance =
    state.status === 'ready'
      ? state.data.balances.find((item) => item.unit === unit)
      : undefined;
  const records =
    state.status === 'ready'
      ? state.data.transactions.filter(
          (item) =>
            item.unit === unit &&
            (direction === 'ALL' || item.direction === direction),
        )
      : [];

  return (
    <section className="container wallet-page">
      <div className="wallet-heading">
        <div>
          <span className="wallet-eyebrow">MY WALLET</span>
          <h1>我的錢包</h1>
          <p>查看餘額與交易記錄</p>
        </div>
        <Link href="/account" className="secondary">
          我的帳戶 ↗
        </Link>
      </div>
      <p className="wallet-preview-banner">
        <strong>演示模式</strong>
        以下為虛構示例資料，與您的帳戶無關。充值不會收款或增加餘額。
      </p>
      <div className="wallet-tabs" role="group" aria-label="錢包幣種">
        {(['USD', 'COIN'] as const).map((value) => (
          <button
            key={value}
            aria-pressed={unit === value}
            onClick={() => {
              setUnit(value);
              setDirection('ALL');
            }}
          >
            {value === 'USD' ? '$ 美元錢包' : '★ 金幣錢包'}
          </button>
        ))}
      </div>
      {state.status === 'loading' && (
        <div className="wallet-placeholder" role="status">
          正在載入錢包…
        </div>
      )}
      {state.status === 'error' && (
        <div className="wallet-placeholder" role="alert">
          <h2>錢包服務暫時無法使用</h2>
          <p>{state.message}</p>
          <button
            className="primary"
            onClick={() => setAttempt((value) => value + 1)}
          >
            重試
          </button>
        </div>
      )}
      {state.status === 'ready' && balance && (
        <>
          <div className="wallet-overview">
            <div className="wallet-balance-card">
              <span className="wallet-eyebrow">
                {unit === 'USD' ? 'USD BALANCE' : 'COIN BALANCE'}
              </span>
              <p>
                可用餘額 <span className="wallet-demo-badge">示例</span>
              </p>
              <strong className="wallet-balance">
                {formatMoney(parseMinor(balance.availableMinor), unit)}
              </strong>
              <div className="wallet-balance-bottom">
                <span>
                  凍結餘額 {formatMoney(parseMinor(balance.frozenMinor), unit)}
                </span>
                {unit === 'USD' ? (
                  <button className="primary" onClick={() => setRecharge(true)}>
                    ＋ 充值預覽
                  </button>
                ) : (
                  <Link href="/coin-boxes" className="secondary">
                    瀏覽金幣盲盒 →
                  </Link>
                )}
              </div>
            </div>
            <aside className="wallet-about">
              <span className="wallet-eyebrow">WALLET GUIDE</span>
              <h2>{unit === 'USD' ? '每一筆，都清楚可見' : '探索免費福利'}</h2>
              <p>
                {unit === 'USD'
                  ? '體驗選擇金額、付款方式與訂單結果的完整操作流程。'
                  : '金幣為獨立的虛擬計價單位，本預覽不提供購買或美元兌換。'}
              </p>
              <p>真實充值、消費、提現及轉帳尚未開放。</p>
              <Link href={unit === 'USD' ? '/boxes' : '/free-boxes'}>
                探索{unit === 'USD' ? '盲盒' : '免費福利'} ↗
              </Link>
            </aside>
          </div>
          <div className="wallet-history">
            <div className="wallet-history-heading">
              <h2>
                交易記錄 <span className="wallet-demo-badge">示例</span>
              </h2>
              <label>
                交易類型{' '}
                <select
                  aria-label="交易類型"
                  value={direction}
                  onChange={(event) => setDirection(event.target.value)}
                >
                  <option value="ALL">全部</option>
                  <option value="CREDIT">收入</option>
                  <option value="DEBIT">支出</option>
                </select>
              </label>
            </div>
            {records.length ? (
              <div className="wallet-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>交易</th>
                      <th>時間（UTC）</th>
                      <th>金額</th>
                      <th>詳情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.description}</strong>
                          <small>{item.id}</small>
                        </td>
                        <td>{item.createdAt.replace('T', ' ').slice(0, 16)}</td>
                        <td
                          className={
                            item.direction === 'CREDIT' ? 'wallet-credit' : ''
                          }
                        >
                          {item.direction === 'CREDIT' ? '+' : '−'}
                          {formatMoney(parseMinor(item.amountMinor), item.unit)}
                        </td>
                        <td>
                          <button
                            className="wallet-detail-button"
                            aria-label={`查看 ${item.id}`}
                            onClick={() => setDetail(item)}
                          >
                            查看 ↗
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="wallet-placeholder">
                <h3>暫無交易記錄</h3>
                <p>此幣種或篩選條件下沒有記錄。</p>
                {direction !== 'ALL' && (
                  <button
                    className="secondary"
                    onClick={() => setDirection('ALL')}
                  >
                    清除篩選
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
      <details className="wallet-preview-controls">
        <summary>預覽情境</summary>
        <label>
          頁面狀態{' '}
          <select
            value={scenario}
            onChange={(event) => {
              setScenario(event.target.value as PreviewScenario);
              setDetail(null);
            }}
          >
            <option value="normal">示例餘額與記錄</option>
            <option value="empty">零餘額與空記錄</option>
            <option value="unavailable">服務不可用</option>
          </select>
        </label>
        <p>僅切換此頁演示資料；重新整理後恢復預設，不寫入帳戶。</p>
      </details>
      {recharge && <RechargeDialog onClose={() => setRecharge(false)} />}
      {detail && (
        <Modal title="交易詳情（示例）" onClose={() => setDetail(null)}>
          <h2>交易詳情（示例）</h2>
          <dl className="recharge-summary">
            <dt>編號</dt>
            <dd>{detail.id}</dd>
            <dt>類型</dt>
            <dd>{detail.description}</dd>
            <dt>金額</dt>
            <dd>
              {detail.direction === 'CREDIT' ? '+' : '−'}
              {formatMoney(parseMinor(detail.amountMinor), detail.unit)}
            </dd>
            <dt>時間（UTC）</dt>
            <dd>{detail.createdAt.replace('T', ' ').replace('Z', '')}</dd>
          </dl>
          <p className="wallet-demo-note">虛構記錄，不代表真實資產變動。</p>
        </Modal>
      )}
    </section>
  );
}
