'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { art, boxes, boxHref, extraArt, money } from '../data/catalog';
import { BoxCard } from './box-card';
import { Icon } from './icon';
import { useSite } from './site-shell';
export function SectionTitle({
  title,
  href,
  label,
}: {
  title: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {href && (
        <Link href={href}>
          {label}
          <Icon name="arrow" size={15} />
        </Link>
      )}
    </div>
  );
}
export function LiveDrops() {
  return (
    <div className="live-drops">
      <div className="online">
        <span className="online-dot" />
        <b>113</b>
        <small>在線</small>
      </div>
      <div className="drop-track">
        {[27, 30, 33, 38, 40, 46, 39, 23, 55, 58].map((n, i) => (
          <div className="live-item" key={n}>
            <img src={art(n)} alt="近期掉落物品" />
            <div>
              <b>
                {money(
                  [0.1, 10, 0.85, 2.5, 0.22, 0.15, 1.25, 0.2, 0.5, 4.2][i] ??
                    0.2,
                )}
              </b>
              <small>{['U***A', 'M***E', 'K***4', 'W***n'][i % 4]}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Rewards({ all = false }: { all?: boolean }) {
  const { login } = useSite();
  const images = [
    art(17),
    art(18),
    art(19),
    art(20),
    art(22),
    art(21),
    extraArt.vip40,
    extraArt.vip50,
  ];
  return (
    <div className="box-grid rewards-grid">
      {[1, 5, 10, 15, 20, 30, 40, 50].slice(0, all ? 8 : 6).map((level, i) => (
        <button className="reward-card" onClick={login} key={level}>
          <img src={images[i]} alt={`VIP${level} 盲盒`} loading="lazy" />
          <div>VIP{level} 免费福利</div>
          <small>VIP{level} 起可用</small>
          <span className="locked">
            <Icon name="lock" size={17} />
            已鎖定
          </span>
        </button>
      ))}
    </div>
  );
}
const players = [
  { name: 'U***P', amount: 456.45 },
  { name: 'E***H', amount: 322.5 },
  { name: 'H***4', amount: 255.39 },
  { name: 'T***M', amount: 229.27 },
  { name: 'U***7', amount: 202.37 },
  { name: 'Y***M', amount: 166.1 },
  { name: 'U***M', amount: 146.58 },
  { name: 'H***G', amount: 121.03 },
  { name: 'U***R', amount: 77.79 },
  { name: 'U***W', amount: 76.68 },
];
export function Leaderboard({ full = false }: { full?: boolean }) {
  return (
    <div className="leaderboard">
      <div className="podium">
        {[1, 0, 2].map((index) => {
          const player = players[index]!;
          return (
            <div
              className={`podium-player rank-${index + 1}`}
              key={player.name}
            >
              <div className="rank-avatar">
                <img src={art(24)} alt="" />
                <img
                  className="rank-frame"
                  src={
                    [
                      '/reference/4918e961d657731f.png',
                      '/reference/8400e1bb4bcac01b.png',
                      '/reference/6e4103b9ffd8faae.png',
                    ][index]
                  }
                  alt={`第 ${index + 1} 名`}
                />
              </div>
              <div className="podium-base">
                <div>
                  {player.name}
                  <span className="vip-label">VIP{index === 1 ? 5 : 1}</span>
                </div>
                <strong>{money(player.amount)}</strong>
                <small>累計消費</small>
              </div>
            </div>
          );
        })}
      </div>
      <div className="ranking-rows">
        {players.slice(3, full ? 10 : 5).map((player, i) => (
          <div className="ranking-row" key={player.name}>
            <span className="rank-number">{i + 4}</span>
            <img src={art(24)} alt="" />
            <span>
              {player.name}
              <span className="vip-label">VIP1</span>
            </span>
            <div>
              <small>累計消費：</small>
              <strong>{money(player.amount)}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Home() {
  const [active, setActive] = useState(0);
  const [banner, setBanner] = useState(0);
  const [paused, setPaused] = useState(false);
  const { info } = useSite();
  const featured = [
    boxes[1]!,
    boxes[6]!,
    boxes[7]!,
    boxes[3]!,
    boxes[0]!,
    boxes[4]!,
  ];
  const current = featured[active]!;
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(
      () => setActive((value) => (value + 1) % 6),
      6000,
    );
    return () => clearInterval(timer);
  }, [paused]);
  useEffect(() => {
    const timer = setInterval(
      () => setBanner((value) => (value + 1) % 4),
      8000,
    );
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="container home">
      <h1 className="sr-only">TURBOX 神秘盲盒</h1>
      <LiveDrops />
      <section
        className="hero-carousel"
        aria-label="精選盲盒"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        <div className="hero-stage">
          <button
            className="hero-side left"
            aria-label="上一個盲盒"
            onClick={() => setActive((active + 5) % 6)}
          >
            <img
              src={featured[(active + 5) % 6]!.image}
              alt={featured[(active + 5) % 6]!.name}
            />
          </button>
          <Link
            href={boxHref(current)}
            className="hero-main"
            key={current.slug}
          >
            <img
              className="hero-badge"
              src="/reference/6108b9e62faecde4.png"
              alt="New"
            />
            <img className="hero-box" src={current.image} alt={current.name} />
          </Link>
          <button
            className="hero-side right"
            aria-label="下一個盲盒"
            onClick={() => setActive((active + 1) % 6)}
          >
            <img
              src={featured[(active + 1) % 6]!.image}
              alt={featured[(active + 1) % 6]!.name}
            />
          </button>
        </div>
        <div className="hero-caption">
          <h2>{current.name}</h2>
          <Link href={boxHref(current)} className="primary hero-open">
            開盒 · {money(current.price)}
          </Link>
        </div>
      </section>
      <section className="promo-banner" aria-label="活動輪播">
        <button
          className="banner-image"
          onClick={() =>
            banner === 2
              ? window.location.assign('/ranking')
              : info(
                  banner === 0
                    ? '正品保障'
                    : banner === 1
                      ? 'TURBOX 社群'
                      : '如何玩 TURBOX',
                  banner === 3
                    ? '選擇盲盒 → 查看物品與概率 → 開箱 → 管理您的物品。'
                    : '探索盲盒、收藏好物，發現更多活動。',
                )
          }
        >
          <img
            src={art([13, 12, 14, 15][banner]!)}
            alt={
              [
                'PHYSICAL PRIZES. AUTHENTICITY GUARANTEED. SECURE DELIVERY.',
                'JOIN THE TURBOX COMMUNITY',
                'FALL BOX BATTLE $1000',
                'HOW TO PLAY TURBOX',
              ][banner]
            }
          />
        </button>
        <div className="banner-dots">
          {[0, 1, 2, 3].map((i) => (
            <button
              key={i}
              aria-label={`活動 ${i + 1}`}
              aria-pressed={banner === i}
              className={banner === i ? 'active' : ''}
              onClick={() => setBanner(i)}
            />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle title="熱門盲盒" href="/boxes" label="查看全部盲盒" />
        <div className="box-grid">
          {[5, 17, 8, 18, 14, 19].map((i) => (
            <BoxCard key={i} box={boxes[i]!} />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle title="精彩時刻" href="/ranking" label="完整排行榜" />
        <Link href="/ranking" className="ranking-promo">
          <Icon name="chart" size={32} />
          <div>
            <b>$1,000排行榜奖励等你来赢！</b>
            <small>冲击秋季盲盒争霸赛前10名！</small>
          </div>
          <Icon name="arrow" />
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
      <div className="trust-banners">
        <button
          onClick={() =>
            info(
              '可驗證公平',
              '每款盲盒在詳情頁公開展示物品概率。正式開箱與驗證功能待後端接入。',
            )
          }
        >
          <img src={art(0)} alt="No shady odds. Just real drops." />
        </button>
        <button
          onClick={() =>
            info('物品管理', '收藏好物或管理您的物品，登入後查看背包。')
          }
        >
          <img src={art(1)} alt="Unbox Now. Instant Liquidation." />
        </button>
      </div>
    </div>
  );
}
