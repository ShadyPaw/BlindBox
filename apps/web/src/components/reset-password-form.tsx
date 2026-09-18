'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { authRequest } from '../lib/auth-client';
export function ResetPasswordForm() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setToken(window.location.hash.slice(1));
    window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return (
    <section className="container account-page">
      <div className="reset-card">
        <h1>重設密碼</h1>
        {done ? (
          <>
            <p role="status">密碼已更新，所有舊登入已失效。</p>
            <Link href="/?login=1" className="primary">
              返回登入
            </Link>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setMessage('');
              try {
                await authRequest('reset-password', { token, password });
                setPassword('');
                setConfirmation('');
                setToken('');
                setDone(true);
                window.dispatchEvent(new Event('box-auth-changed'));
              } catch (error) {
                setMessage(error instanceof Error ? error.message : '重設失敗');
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="muted">連結 30 分鐘內有效，使用後立即失效。</p>
            {!/^[a-f0-9]{64}$/.test(token) && (
              <p className="notice">
                請從密碼重設郵件開啟有效連結；重新整理後需再次開啟郵件中的連結。
              </p>
            )}
            <label className="field-label">
              新密碼
              <input
                type="password"
                autoComplete="new-password"
                minLength={15}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              確認新密碼
              <input
                type="password"
                autoComplete="new-password"
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </label>
            <button
              className="primary wide"
              disabled={
                busy ||
                !/^[a-f0-9]{64}$/.test(token) ||
                password.length < 15 ||
                password !== confirmation
              }
            >
              {busy ? '更新中…' : '更新密碼'}
            </button>
            {message && (
              <p className="notice" role="status">
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
