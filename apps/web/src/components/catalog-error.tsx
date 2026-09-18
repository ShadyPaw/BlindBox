'use client';
export function CatalogError({ reset }: { reset: () => void }) {
  return (
    <section className="container empty-state" role="alert">
      <h1>盲盒目錄服務暫時不可用</h1>
      <p>Catalog service unavailable，請稍後重試。</p>
      <button className="primary" onClick={reset}>
        重試
      </button>
    </section>
  );
}
