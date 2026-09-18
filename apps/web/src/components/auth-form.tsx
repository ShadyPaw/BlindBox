'use client';
import Link from 'next/link';
import { useState } from 'react';
import { emailSchema } from '@box/validation';
import type { AuthUser } from '@box/types';
import { authRequest } from '../lib/auth-client';

export function AuthForm({
  initialMode = 'login',
  onNavigate,
  onSuccess,
}: {
  initialMode?: 'login' | 'register';
  onNavigate: () => void;
  onSuccess: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(
    initialMode,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [agree, setAgree] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const requirements: string[] = [];
  if (!emailSchema.safeParse(email).success)
    requirements.push('請填寫有效的電子郵箱');
  if (mode !== 'forgot') {
    if (mode === 'register' && password.length < 15)
      requirements.push(`密碼至少需要 15 個字元，目前為 ${password.length} 個`);
    else if (!password) requirements.push('請填寫密碼');
    if (password.length > 128) requirements.push('密碼不能超過 128 個字元');
  }
  if (mode === 'register') {
    if (!confirmation) requirements.push('請再次輸入密碼');
    else if (password !== confirmation)
      requirements.push('兩次輸入的密碼不一致');
    if (!agree) requirements.push('請勾選同意服務條款與隱私政策');
  }
  const valid = requirements.length === 0;
  function switchMode(next: typeof mode) {
    setMode(next);
    setPassword('');
    setConfirmation('');
    setMessage('');
  }
  return (
    <>
      <div className="auth-brand">
        <img src="/reference/4e12ca7237f7ca5a.png" alt="TURBOX" />
        <p>
          {mode === 'register'
            ? '建立您的帳戶'
            : mode === 'forgot'
              ? '重設您的密碼'
              : '登入您的帳戶'}
        </p>
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (!valid || busy) return;
          setBusy(true);
          setMessage('');
          try {
            if (mode === 'forgot') {
              const result = await authRequest<{ message: string }>(
                'forgot-password',
                { email },
              );
              setMessage(result.message);
            } else {
              const result = await authRequest(mode, { email, password });
              setPassword('');
              onSuccess(result.user);
            }
          } catch (error) {
            setMessage(error instanceof Error ? error.message : '請稍後重試');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field-label">
          電子郵箱
          <input
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            placeholder="name@example.com"
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        {mode !== 'forgot' && (
          <label className="field-label">
            密碼
            <div className="password-field">
              <input
                aria-label="密碼"
                type={show ? 'text' : 'password'}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                minLength={mode === 'register' ? 15 : 1}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                aria-label={show ? '隱藏密碼' : '顯示密碼'}
                onClick={() => setShow(!show)}
              >
                {show ? '隱藏' : '顯示'}
              </button>
            </div>
          </label>
        )}
        {mode === 'register' && (
          <>
            <p className="auth-help">
              請使用 15–128 個字元的密碼，可使用空格和各種文字。
            </p>
            <label className="field-label">
              確認密碼
              <input
                aria-label="確認密碼"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmation}
                maxLength={128}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </label>
            <div className="auth-options">
              <label>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                我同意{' '}
                <Link href="/protocol/terms" onClick={onNavigate}>
                  服務條款
                </Link>{' '}
                和{' '}
                <Link href="/protocol/privacy" onClick={onNavigate}>
                  隱私政策
                </Link>
              </label>
            </div>
          </>
        )}
        <button
          className="primary wide"
          disabled={!valid || busy}
          aria-describedby={!valid ? 'auth-requirements' : undefined}
        >
          {busy
            ? '處理中…'
            : mode === 'register'
              ? '建立帳戶'
              : mode === 'forgot'
                ? '發送重設連結'
                : '登入'}
        </button>
        <div id="auth-requirements" aria-live="polite">
          {!valid && (
            <p className="notice">尚未完成：{requirements.join('；')}。</p>
          )}
        </div>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </form>
      <div className="auth-mode-links">
        {mode === 'login' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => switchMode('forgot')}
          >
            忘記密碼？
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? '還沒有帳戶？註冊' : '返回登入'}
        </button>
      </div>
      <p className="auth-help">
        目前支援郵箱與密碼登入。手機驗證與 Google 登入尚未開放。
      </p>
    </>
  );
}
