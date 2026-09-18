'use client';
import { useEffect, useRef, useState } from 'react';
import type { CatalogList } from '@box/types';
import { defaultFilters, filterQuery, type Filters } from './catalog-filters';

export function useCatalog(initial: CatalogList) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [result, setResult] = useState(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [reload, setReload] = useState(0);
  const version = useRef(0);
  const previousSearch = useRef(defaultFilters.search);
  const controller = useRef<AbortController | null>(null);
  const update = (patch: Partial<Filters>) => {
    // Invalidate immediately on input, before debounce/effects run. Abort alone is insufficient.
    version.current++;
    controller.current?.abort();
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }));
  };
  useEffect(() => {
    const requestVersion = ++version.current;
    const abort = new AbortController();
    controller.current = abort;
    const delay = previousSearch.current === filters.search ? 0 : 300;
    previousSearch.current = filters.search;
    setLoading(true);
    setError('');
    const timer = setTimeout(async () => {
      try {
        let query: string;
        try {
          query = filterQuery(filters);
        } catch {
          throw new Error('價格請輸入最多兩位小數的非負數字');
        }
        const response = await fetch(`/api/catalog/boxes?${query}`, {
          cache: 'no-store',
          signal: abort.signal,
        });
        if (!response.ok)
          throw new Error(
            '盲盒目錄服務暫時不可用（Catalog service unavailable）',
          );
        const data: CatalogList = await response.json();
        if (version.current === requestVersion && !abort.signal.aborted)
          setResult(data);
      } catch (failure) {
        if (version.current === requestVersion && !abort.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : 'Catalog service unavailable',
          );
      } finally {
        if (version.current === requestVersion && !abort.signal.aborted)
          setLoading(false);
      }
    }, delay);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [filters, reload]);
  return {
    filters,
    update,
    result,
    loading,
    error,
    retry: () => setReload((value) => value + 1),
    clear: () => update(defaultFilters),
  };
}
