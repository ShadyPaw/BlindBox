import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="container empty-state">
      <h1>找不到這個頁面</h1>
      <p>這個盲盒或頁面暫時不存在。</p>
      <Link className="primary" href="/boxes">
        瀏覽盲盒
      </Link>
    </div>
  );
}
