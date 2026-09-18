import Link from 'next/link';
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="container protocol-page">
      <Link href="/">‹ 返回首頁</Link>
      <h1>{slug === 'privacy' || slug === '16' ? '隱私政策' : '服務條款'}</h1>
      <p>
        這是 TURBOX
        前台還原的開發預覽，現已接入本專案的郵箱密碼帳戶服務。尚未提供付款、提現或配送服務。
      </p>
      <p>
        註冊資料會送至本專案
        API，郵箱與密碼雜湊會儲存在本專案資料庫，不會送往原站。登入使用 HttpOnly
        Cookie；本地開發的重置郵件可能寫入開發機檔案。此頁是功能說明，正式服務條款與隱私政策尚待完成。
      </p>
    </div>
  );
}
