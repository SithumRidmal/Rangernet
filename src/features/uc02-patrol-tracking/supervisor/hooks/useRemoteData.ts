import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { cacheGet, cacheSet } from '@shared/sync/localDb';
import { getErrorMessage } from '@shared/utils/errors';

type CacheEnvelope = { savedAt: string; value: unknown };

export type RemoteCodec<T> = {
  toCache: (value: T) => unknown;
  fromCache: (cached: unknown) => T;
};

export type RemoteData<T> = {
  data: T | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  /** True when `data` comes from the device cache because the server could not be reached. */
  stale: boolean;
  savedAt: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
};

/**
 * Online-first loader: always asks Supabase, keeps the last good result on the device
 * and falls back to it (marked stale) when the request fails.
 */
export function useRemoteData<T>(cacheKey: string, load: () => Promise<T>, codec?: RemoteCodec<T>): RemoteData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const loadRef = useRef(load);
  const codecRef = useRef(codec);
  const request = useRef(0);
  /** cacheKey whose data is currently shown; a new key starts from an empty state. */
  const loadedKey = useRef<string | null>(null);
  useLayoutEffect(() => {
    loadRef.current = load;
    codecRef.current = codec;
  });

  const [dataKey, setDataKey] = useState(cacheKey);
  if (dataKey !== cacheKey) {
    setDataKey(cacheKey);
    setData(null);
    setLoading(true);
  }

  const run = useCallback(
    async (mode: 'silent' | 'pull') => {
      const id = ++request.current;
      if (mode === 'pull') setRefreshing(true);
      if (loadedKey.current !== cacheKey) setLoading(true);
      try {
        const value = await loadRef.current();
        if (id !== request.current) return;
        const now = new Date().toISOString();
        loadedKey.current = cacheKey;
        setData(value);
        setError(null);
        setStale(false);
        setSavedAt(now);
        const cached = codecRef.current ? codecRef.current.toCache(value) : value;
        cacheSet<CacheEnvelope>(cacheKey, { savedAt: now, value: cached }).catch(() => undefined);
      } catch (e) {
        if (id !== request.current) return;
        setError(getErrorMessage(e));
        if (loadedKey.current !== cacheKey) {
          const env = await cacheGet<CacheEnvelope>(cacheKey);
          if (id !== request.current) return;
          if (env) {
            try {
              const value = codecRef.current ? codecRef.current.fromCache(env.value) : (env.value as T);
              loadedKey.current = cacheKey;
              setData(value);
              setSavedAt(env.savedAt);
            } catch {
              // Cached shape from an older build – ignore it.
            }
          }
        }
        setStale(true);
      } finally {
        if (id === request.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [cacheKey],
  );

  const reload = useCallback(() => run('silent'), [run]);
  const refresh = useCallback(() => run('pull'), [run]);

  return { data, loading, refreshing, error, stale, savedAt, reload, refresh };
}
