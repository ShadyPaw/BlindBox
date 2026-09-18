'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="container account-page">
      <h1>帳戶服務暫時不可用</h1>
      <p>暫時無法載入您的帳戶，請稍後重試。</p>
      <button className="primary" onClick={reset}>
        重試
      </button>
    </section>
  );
}
