'use client';
import Link from 'next/link';
import { useState } from 'react';
import { boxPrice } from '../data/catalog';
import { formatMoney, parseMinor } from '@box/money';
import type { CatalogDetail, CatalogBoxItem } from '@box/types';
import { Icon } from './icon';
import { BoxCard } from './box-card';
import { LiveDrops, SectionTitle } from './home';
import { useSite } from './site-shell';
export function DetailView({
  box,
  items: prizes,
  relatedBoxes,
}: CatalogDetail) {
  const [quantity, setQuantity] = useState(1);
  const [fast, setFast] = useState(false);
  const [sound, setSound] = useState(true);
  const [infinite, setInfinite] = useState(false);
  const { login, info } = useSite();
  const coins = box.mode === 'COIN';
  const price = (item: CatalogBoxItem) =>
    formatMoney(parseMinor(item.displayValueMinor), item.displayValueUnit);
  const displayProbability = (item: CatalogBoxItem) =>
    item.displayProbabilityPercent === null
      ? '展示概率未提供'
      : `${item.displayProbabilityPercent}%`;
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
          {(prizes.length
            ? prizes.slice(0, 5)
            : [{ id: box.id, name: box.name, image: box.image }]
          ).map((prize, i) => (
            <div
              key={prize.id}
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
        <p>{box.description ?? '這款盲盒的完整說明尚未接入。'}</p>
      </details>
      <SectionTitle title="盲盒內容" />
      {box.completenessStatus === 'INCOMPLETE' && (
        <p className="notice">參考資料尚未補齊，以下僅展示已接入的內容。</p>
      )}
      {prizes.length > 0 ? (
        <div className="prize-grid">
          {prizes.map((prize, i) => (
            <button
              className={`prize-card rarity-${i < 3 ? 'red' : i < 8 ? 'gold' : 'blue'}`}
              key={prize.id}
              onClick={() =>
                info(
                  prize.name,
                  `物品價值 ${price(prize)} · 公開概率 ${displayProbability(prize)}。此為參考頁面展示資料，前台預覽不產生真實掉落。`,
                )
              }
            >
              <span className="probability">{displayProbability(prize)}</span>
              <img src={prize.image} alt={prize.name} />
              <strong>{price(prize)}</strong>
              <p>{prize.name}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state compact">
          <Icon name="box" size={32} />
          <p>物品清單尚未接入</p>
        </div>
      )}
      <SectionTitle title="相關盲盒" />
      <div className="box-grid">
        {relatedBoxes.map((item) => (
          <BoxCard key={item.slug} box={item} />
        ))}
      </div>
    </div>
  );
}
