import { requireUser } from '../../lib/auth-server';
export const metadata = { title: '我的帳戶 · TURBOX' };
export default async function Page() {
  const user = await requireUser();
  return (
    <section className="container account-page">
      <h1>我的帳戶</h1>
      <p className="muted">管理您的登入資訊</p>
      <dl className="account-details">
        <dt>電子郵箱</dt>
        <dd>{user.email}</dd>
        <dt>帳戶編號</dt>
        <dd>{user.id}</dd>
        <dt>角色</dt>
        <dd>{user.role === 'ADMIN' ? '管理員' : '普通會員'}</dd>
        <dt>加入時間</dt>
        <dd>{user.createdAt.slice(0, 10)}</dd>
      </dl>
      <p className="notice">
        郵箱所有權驗證尚未開放；錢包、背包及交易功能將於後續階段接入。
      </p>
    </section>
  );
}
