'use client';

import { useEffect, useRef, useState } from 'react';
import { formatMoney, parseMinor } from '@box/money';
import type { RechargeOrder } from '@box/types';
import {
  createWalletPreview,
  previewMethods,
  rechargeAmount,
  type PreviewOutcome,
} from '../lib/wallet-preview';
import { Modal } from './site-shell';

type Step = 'amount' | 'method' | 'review' | 'pending' | 'result';
const steps: Step[] = ['amount', 'method', 'review'];
const outcomeLabels = { SUCCEEDED: '成功', FAILED: '失敗', CANCELLED: '取消' };

export function RechargeDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('25');
  const [method, setMethod] = useState<string>(previewMethods[0].id);
  const [outcome, setOutcome] = useState<PreviewOutcome>('SUCCEEDED');
  const [order, setOrder] = useState<RechargeOrder | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const gateway = useRef(createWalletPreview());
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  function close() {
    // Closing invalidates the local request; it does not pretend to cancel a provider payment.
    request.current?.abort();
    onClose();
  }
  function next() {
    try {
      rechargeAmount(amount);
      setError('');
      setStep('method');
    } catch {
      setError('請輸入 $5.00–$1,000.00 的金額，最多兩位小數，不接受負數。');
    }
  }
  async function submit() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    gateway.current = createWalletPreview('normal', outcome);
    try {
      const created = await gateway.current.createRecharge(
        { amountMinor: rechargeAmount(amount), unit: 'USD', methodId: method },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setOrder(created);
      setStep('pending');
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : '無法建立演示訂單');
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  async function check() {
    if (!order || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = await gateway.current.getRecharge(
        order.id,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setOrder(result);
      setStep('result');
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : '無法查詢演示訂單');
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <Modal title="充值預覽" onClose={close} className="recharge-modal">
      <span className="wallet-eyebrow">DEPOSIT · PREVIEW</span>
      <h2 ref={heading} tabIndex={-1}>
        {step === 'pending'
          ? '等待付款（演示）'
          : step === 'result'
            ? '充值結果（演示）'
            : '充值預覽'}
      </h2>
      <p className="wallet-demo-note">僅供體驗流程，不會收款或增加真實餘額。</p>
      <ol className="recharge-steps" aria-label="充值步驟">
        {['選擇金額', '付款方式', '確認資料'].map((label, index) => (
          <li
            key={label}
            aria-current={step === steps[index] ? 'step' : undefined}
            className={step === steps[index] ? 'active' : ''}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {step === 'amount' && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            next();
          }}
          noValidate
        >
          <label className="wallet-label" htmlFor="recharge-amount">
            充值金額（USD）
          </label>
          <div className="recharge-input">
            <span>$</span>
            <input
              id="recharge-amount"
              inputMode="decimal"
              maxLength={24}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError('');
              }}
              aria-invalid={Boolean(error)}
              aria-describedby="amount-help recharge-error"
            />
          </div>
          <p id="amount-help" className="wallet-hint">
            演示範圍 $5–$1,000，最多兩位小數。
          </p>
          <div className="recharge-presets">
            {['10', '25', '50', '100', '250', '500'].map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={amount === value}
                onClick={() => {
                  setAmount(value);
                  setError('');
                }}
              >
                ${value}
              </button>
            ))}
          </div>
          <button className="primary wide" type="submit">
            下一步：付款方式
          </button>
        </form>
      )}
      {step === 'method' && (
        <>
          <fieldset className="recharge-methods">
            <legend>選擇付款方式</legend>
            {previewMethods.map((item) => (
              <label
                key={item.id}
                className={method === item.id ? 'selected' : ''}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={item.id}
                  checked={method === item.id}
                  onChange={() => setMethod(item.id)}
                />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description} · 尚未接入</small>
                </span>
              </label>
            ))}
          </fieldset>
          <p className="wallet-hint">
            實際支援渠道與費用將在支付服務確認後提供。
          </p>
          <div className="wallet-button-row">
            <button className="secondary" onClick={() => setStep('amount')}>
              上一步
            </button>
            <button className="primary" onClick={() => setStep('review')}>
              下一步：確認資料
            </button>
          </div>
        </>
      )}
      {step === 'review' && (
        <>
          <dl className="recharge-summary">
            <dt>充值金額</dt>
            <dd>{formatMoney(parseMinor(rechargeAmount(amount)), 'USD')}</dd>
            <dt>付款方式</dt>
            <dd>{previewMethods.find((item) => item.id === method)?.name}</dd>
            <dt>手續費</dt>
            <dd>待渠道確認</dd>
          </dl>
          <label className="wallet-label" htmlFor="preview-outcome">
            演示結果
          </label>
          <select
            id="preview-outcome"
            value={outcome}
            disabled={busy}
            onChange={(event) =>
              setOutcome(event.target.value as PreviewOutcome)
            }
          >
            {Object.entries(outcomeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="wallet-button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setStep('method')}
            >
              上一步
            </button>
            <button className="primary" disabled={busy} onClick={submit}>
              {busy ? '建立中…' : '開始演示付款'}
            </button>
          </div>
        </>
      )}
      {step === 'pending' && order && (
        <div className="recharge-result" aria-live="polite">
          <div className="wallet-result-symbol">◷</div>
          <h3>演示訂單已建立</h3>
          <p>未連接第三方支付，無需輸入銀行卡或付款資料。</p>
          <p className="wallet-order-id">{order.id}</p>
          <button className="primary wide" disabled={busy} onClick={check}>
            {busy ? '查詢中…' : '查看演示結果'}
          </button>
          <button className="secondary wide" onClick={close}>
            關閉演示
          </button>
        </div>
      )}
      {step === 'result' && order && order.status !== 'PENDING' && (
        <div className="recharge-result" aria-live="polite">
          <div className={`wallet-result-symbol ${order.status.toLowerCase()}`}>
            {order.status === 'SUCCEEDED'
              ? '✓'
              : order.status === 'FAILED'
                ? '!'
                : '−'}
          </div>
          <h3>演示付款{outcomeLabels[order.status]}</h3>
          <p>
            {order.status === 'SUCCEEDED'
              ? '流程演示已完成，沒有發生真實付款，餘額保持不變。'
              : '沒有發生扣款。您可以返回修改資料後重新體驗。'}
          </p>
          <button className="primary wide" onClick={close}>
            返回錢包
          </button>
          {order.status !== 'SUCCEEDED' && (
            <button
              className="secondary wide"
              onClick={() => {
                setOrder(null);
                setStep('amount');
              }}
            >
              重新選擇金額
            </button>
          )}
        </div>
      )}
      <p
        id="recharge-error"
        className="wallet-error"
        role={error ? 'alert' : undefined}
      >
        {error}
      </p>
    </Modal>
  );
}
