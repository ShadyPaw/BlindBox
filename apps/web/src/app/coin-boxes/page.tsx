import Link from 'next/link';
import { coinBoxes } from '../../data/catalog';
import { BoxCard } from '../../components/box-card';
import {
  Leaderboard,
  LiveDrops,
  Rewards,
  SectionTitle,
} from '../../components/home';

export const metadata = { title: '免費模式 · TURBOX' };

export default function Page() {
  return (
    <div className="container home coin-home">
      <h1 className="sr-only">免費模式盲盒</h1>
      <LiveDrops />
      <div className="box-grid" aria-label="金幣盲盒列表">
        {coinBoxes.map((box) => (
          <BoxCard key={box.slug} box={box} />
        ))}
      </div>
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
