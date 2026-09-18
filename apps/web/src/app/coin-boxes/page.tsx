import Link from 'next/link';
import { loadCatalog } from '../../lib/catalog-server';
import { BoxCard } from '../../components/box-card';
import {
  Leaderboard,
  LiveDrops,
  Rewards,
  SectionTitle,
} from '../../components/home';

export const metadata = { title: '免費模式 · TURBOX' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const raw = (await searchParams).page ?? '1';
  const page = /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : 1;
  const catalog = await loadCatalog('COIN', page);
  return (
    <div className="container home coin-home">
      <h1 className="sr-only">免費模式盲盒</h1>
      <LiveDrops />
      <div className="box-grid" aria-label="金幣盲盒列表">
        {catalog.boxes.map((box) => (
          <BoxCard key={box.slug} box={box} />
        ))}
      </div>
      {!catalog.boxes.length && (
        <p className="empty-state">沒有符合條件的盲盒</p>
      )}
      <nav aria-label="目錄分頁">
        {page > 1 && <Link href={`/coin-boxes?page=${page - 1}`}>上一頁</Link>}
        {page * catalog.pageSize < catalog.total && (
          <Link href={`/coin-boxes?page=${page + 1}`}>下一頁</Link>
        )}
      </nav>
      <section>
        <SectionTitle title="精彩時刻" href="/ranking" label="完整排行榜" />
        <Link href="/ranking" className="ranking-promo">
          <div>
            <b>$1,000排行榜奖励等你来赢！</b>
            <small>冲击秋季盲盒争霸赛前10名！</small>
          </div>
        </Link>
        <Leaderboard />
      </section>
      <section>
        <SectionTitle
          title="免費福利"
          href="/free-boxes"
          label="更多免費福利"
        />
        <Rewards />
      </section>
    </div>
  );
}
