'use client';
import type { CatalogList } from '@box/types';
import { useCatalog } from '../lib/use-catalog';
import { BoxCard } from './box-card';
import { Icon } from './icon';
export function CatalogView({ initial }: { initial: CatalogList }) {
  const {
    filters,
    update,
    result: data,
    loading,
    error,
    retry,
    clear,
  } = useCatalog(initial);
  const result = data.boxes;
  return (
    <div className="container catalog-page">
      <div className="filters">
        <div className="filter-tags">
          <span>
            <Icon name="filter" />
            篩選
          </span>
          <button
            className={filters.category ? 'selected' : ''}
            aria-pressed={filters.category}
            onClick={() => update({ category: !filters.category })}
          >
            Collectibles
          </button>
          <button
            className={filters.tag === 'new' ? 'selected' : ''}
            aria-pressed={filters.tag === 'new'}
            onClick={() => update({ tag: filters.tag === 'new' ? '' : 'new' })}
          >
            <Icon name="bolt" size={16} />
            最新
          </button>
          <button
            className={filters.tag === 'hot' ? 'selected' : ''}
            aria-pressed={filters.tag === 'hot'}
            onClick={() => update({ tag: filters.tag === 'hot' ? '' : 'hot' })}
          >
            <Icon name="flame" size={16} />
            熱門
          </button>
        </div>
        <div className="filter-controls">
          <div className="price-inputs">
            <label>
              $
              <input
                aria-label="最低價格"
                type="number"
                min="0"
                max="10000"
                value={filters.min}
                onChange={(e) => update({ min: e.target.value })}
              />
            </label>
            <span>－</span>
            <label>
              $
              <input
                aria-label="最高價格"
                type="number"
                min="0"
                max="10000"
                value={filters.max}
                onChange={(e) => update({ max: e.target.value })}
              />
            </label>
          </div>
          <div className="price-range">
            <input
              aria-label="價格上限滑桿"
              type="range"
              min="0"
              max="10000"
              step="1"
              value={filters.max}
              onChange={(e) => update({ max: e.target.value })}
            />
          </div>
          <select
            aria-label="排序方式"
            value={filters.sort}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="">排序方式…</option>
            <option value="low">價格：由低至高</option>
            <option value="high">價格：由高至低</option>
            <option value="name">名稱：A–Z</option>
          </select>
          <label className="search-field">
            <Icon name="search" size={18} />
            <input
              type="search"
              aria-label="按名稱搜尋"
              placeholder="按名稱搜尋"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
            />
          </label>
          <button className="clear-filter" onClick={clear}>
            ⌫ 清除篩選
          </button>
        </div>
      </div>
      <h1>神秘盲盒</h1>
      <p className="page-subtitle">立即開箱，每個盲盒都有機會帶走心儀好物！</p>
      {loading && <p role="status">載入盲盒中…</p>}
      {error && (
        <div role="alert" className="empty-state">
          <p>{error}</p>
          <button className="primary" onClick={retry}>
            重試
          </button>
        </div>
      )}
      <div className="box-grid" aria-label="盲盒列表" aria-busy={loading}>
        {!error && result.map((box) => <BoxCard key={box.slug} box={box} />)}
      </div>
      {!error && !loading && !result.length && (
        <div className="empty-state">
          <Icon name="search" size={44} />
          <h2>沒有符合條件的盲盒</h2>
          <p>試試其他名稱或調整價格範圍。</p>
          <button className="primary" onClick={clear}>
            清除篩選
          </button>
        </div>
      )}
      {!error && (
        <nav aria-label="目錄分頁">
          {filters.page > 1 && (
            <button onClick={() => update({ page: filters.page - 1 })}>
              上一頁
            </button>
          )}
          {filters.page * data.pageSize < data.total && (
            <button onClick={() => update({ page: filters.page + 1 })}>
              下一頁
            </button>
          )}
        </nav>
      )}
    </div>
  );
}
