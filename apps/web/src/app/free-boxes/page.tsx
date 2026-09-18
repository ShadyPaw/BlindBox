import { Rewards } from '../../components/home';
export const metadata = { title: '免費福利 · TURBOX' };
export default function Page() {
  return (
    <div className="container rewards-page">
      <h1>免費福利</h1>
      <p className="page-subtitle">依會員等級解鎖高級盲盒。</p>
      <Rewards all />
    </div>
  );
}
