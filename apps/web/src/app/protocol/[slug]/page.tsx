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
        前台還原的本地預覽。目前沒有帳戶建立、驗證碼發送、付款、提現或配送服務。
      </p>
      <p>
        您在預覽表單輸入的資料只用於當前頁面驗證，不會送往原站或儲存為帳戶。正式服務條款與隱私政策將在後端服務接入時提供。
      </p>
    </div>
  );
}
