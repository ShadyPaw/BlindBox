'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  boxes,
  coinBoxes,
  boxPrice,
  money,
  boxPrizes,
  type Box,
} from '../data/catalog';
import { Icon } from './icon';
import { BoxCard } from './box-card';
import { LiveDrops, SectionTitle } from './home';
import { useSite } from './site-shell';
export function DetailView({ box }: { box: Box }) {
  const [quantity, setQuantity] = useState(1);
  const [fast, setFast] = useState(false);
  const [sound, setSound] = useState(true);
  const [infinite, setInfinite] = useState(false);
  const { login, info } = useSite();
  const prizes = boxPrizes(box.slug);
  const coins = box.currency === 'coins';
  const price = (value: number) =>
    coins ? boxPrice({ ...box, price: value }) : money(value);
  return (
    <div className="container detail-page">
      <div className="detail-toolbar">
        <Link className="back-button" href={coins ? '/coin-boxes' : '/boxes'}>
          ‹ 返回
        </Link>
        <h1>{box.name}</h1>
        <div className="detail-options">
          <button
            role="switch"
            aria-checked={fast}
            onClick={() => setFast(!fast)}
          >
            極速開箱
            <span className={`toggle ${fast ? 'on' : ''}`} />
          </button>
          <button
            role="switch"
            aria-checked={sound}
            onClick={() => setSound(!sound)}
          >
            開箱音效
            <span className={`toggle ${sound ? 'on' : ''}`} />
          </button>
          <button
            aria-label="分享"
            onClick={() => {
              navigator.clipboard
                .writeText(window.location.href)
                .then(() => info('分享', '連結已複製到剪貼簿。'))
                .catch(() => info('分享', window.location.href));
            }}
          >
            <Icon name="share" />
          </button>
        </div>
      </div>
      <div className="opening-stage">
        <span className="stage-pointer top">▼</span>
        <div className="opening-track">
          {(prizes
            ? prizes.slice(0, 5)
            : [{ name: box.name, image: box.image }]
          ).map((prize, i) => (
            <div
              key={prize.name}
              className={`opening-item rarity-${i < 3 ? 'red' : 'gold'}`}
            >
              <img src={prize.image} alt={prize.name} />
            </div>
          ))}
        </div>
        <span className="stage-pointer bottom">▲</span>
      </div>
      <div className="opening-controls">
        <div className="quantity-picker" aria-label="開箱數量">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              aria-pressed={!infinite && quantity === n}
              className={!infinite && quantity === n ? 'selected' : ''}
              key={n}
              onClick={() => {
                setQuantity(n);
                setInfinite(false);
              }}
            >
              {n}
            </button>
          ))}
          <button
            aria-label="連續開箱"
            aria-pressed={infinite}
            className={infinite ? 'selected' : ''}
            onClick={() => setInfinite(!infinite)}
          >
            ∞
          </button>
        </div>
        <button className="primary open-button" onClick={login}>
          以 {boxPrice(box, quantity)} 開箱
        </button>
      </div>
      {!coins && (
        <>
          <SectionTitle title="掉落物品" />
          <LiveDrops />
        </>
      )}
      <details className="box-description" open>
        <summary>
          <img src={box.image} alt="" />
          <div>
            <strong>{box.name}</strong>
            <b>{boxPrice(box)}</b>
          </div>
          <span>⌄</span>
        </summary>
        <p>
          {box.slug === 'cozy-christmas'
            ? 'Discover the cozy side of the season with cheerful Christmas style, playful decorations, and charming little holiday moments. Every reveal adds a fresh spark of color and personality to the experience, making each opening feel warm, festive, and fun. A lighthearted way to explore the spirit of the holidays.'
            : box.slug === 'everyday-sync'
              ? 'Find a fresh connection between tech and everyday life. Each reveal brings a digital item inspired by mobile creativity, personal audio, wearables, home entertainment, or useful little extras. Explore Apple-related themes and practical discoveries that can add a new spark to your setup and daily routine. Digital items only; no physical devices, accessories, or shipping are included. Specific contents and usage terms are shown on the product and checkout pages.'
              : box.slug === 'one-piece-voyage'
                ? 'Set sail through One Piece characters and card art. Each reveal brings a fresh digital collectible discovery to your fandom collection. Digital items only; no physical cards or shipping. Contents and usage terms appear before payment.'
                : box.slug === 'next-gen-discovery'
                  ? 'Explore the energy of next-gen tech, from mobile innovation to gaming and setup upgrades. Each box brings a fresh way to refresh your digital lifestyle, with practical finds and exciting discoveries made for everyday use.'
                  : '探索 ' +
                    box.name +
                    '，發現心儀好物。這款盲盒的完整物品清單將在資料接入後提供。'}
        </p>
      </details>
      <SectionTitle title="盲盒內容" />
      {prizes ? (
        <div className="prize-grid">
          {prizes.map((prize, i) => (
            <button
              className={`prize-card rarity-${i < 3 ? 'red' : i < 8 ? 'gold' : 'blue'}`}
              key={prize.name}
              onClick={() =>
                info(
                  prize.name,
                  `物品價值 ${price(prize.price)} · 公開概率 ${prize.probability}%。此為參考頁面展示資料，前台預覽不產生真實掉落。`,
                )
              }
            >
              <span className="probability">{prize.probability}%</span>
              <img src={prize.image} alt={prize.name} />
              <strong>{price(prize.price)}</strong>
              <p>{prize.name}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <Icon name="box" size={32} />
          <p>物品清單尚未接入</p>
          <Link href="/boxes/everyday-sync">
            查看完整詳情頁示例：Everyday Sync ›
          </Link>
        </div>
      )}
      <SectionTitle title="相關盲盒" />
      <div className="box-grid">
        {(coins ? coinBoxes : boxes)
          .filter((item) => item.slug !== box.slug)
          .slice(0, 6)
          .map((item) => (
            <BoxCard key={item.slug} box={item} />
          ))}
      </div>
    </div>
  );
}
