'use client';
import { useState } from 'react';
import { Leaderboard } from './home';
import { useSite } from './site-shell';
export function RankingView() {
  const [previous, setPrevious] = useState(false);
  const { info } = useSite();
  return (
    <div className="ranking-page">
      <div className="ranking-hero">
        <div className="ranking-period mode-switch">
          <button
            className={!previous ? 'selected' : ''}
            onClick={() => setPrevious(false)}
          >
            本期
          </button>
          <button
            className={previous ? 'selected' : ''}
            onClick={() => setPrevious(true)}
          >
            上期
          </button>
        </div>
        <div className="ranking-heading">
          <span>{previous ? '上期' : '本期'}</span>
          <h1>Fall Box Battle</h1>
          <p>
            {previous
              ? '暫無可用的上期榜單資料'
              : 'Sep 17, 7:00 AM - Sep 24, 6:59 AM ET'}
          </p>
          <div className="trophy">🏆</div>
        </div>
      </div>
      <div className="container">
        <div className="ranking-info">
          <button
            onClick={() =>
              info(
                '獎勵詳情',
                '總獎池 $1,000。前 10 名可獲得活動獎勵，活動結束後結算。此為參考活動的前台展示。',
              )
            }
          >
            獎勵詳情 <span>›</span>
            <small>查看獎品與結算</small>
          </button>
          <button
            onClick={() =>
              info(
                '參賽規則',
                '活動依累計消費金額排名。登入後可查看自己的參賽資格與排名。前台展示數據不參與真實活動。',
              )
            }
          >
            參賽規則 <span>›</span>
            <small>查看參賽資格與排名</small>
          </button>
        </div>
        {previous ? (
          <div className="empty-state">
            <h2>暫無上期排名</h2>
            <button className="primary" onClick={() => setPrevious(false)}>
              查看本期
            </button>
          </div>
        ) : (
          <>
            <div className="ranking-title">
              <h2>
                全部排名 <small>排名指標：消費金額</small>
              </h2>
              <span>
                更新於 11:25 PM ET{' '}
                <button
                  aria-label="重新整理排行榜"
                  onClick={() =>
                    info(
                      '排行榜已更新',
                      '目前顯示參考活動的靜態排名。即時排名將在後端接入後提供。',
                    )
                  }
                >
                  ⟳
                </button>
              </span>
            </div>
            <Leaderboard full />
          </>
        )}
      </div>
    </div>
  );
}
