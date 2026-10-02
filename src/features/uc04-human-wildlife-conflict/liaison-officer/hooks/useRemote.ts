import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DependencyList } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSync } from '@shared/sync/SyncProvider';

type Mode = 'load' | 'refresh' | 'silent';

/**
 * Online-only data loader for CLO screens: initial load, pull-to-refresh, silent refetch on
 * screen focus and when the connection comes back. Stale responses are discarded.
 * Changing `resetKey` clears the current data (e.g. a different filter) instead of refreshing it silently.
 */
export function useRemote<T>(fetcher: () => Promise<T>, deps: DependencyList, resetKey?: string) {
  const { online } = useSync();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });
  const seq = useRef(0);
  const hasData = useRef(false);

  const run = useCallback(async (mode: Mode) => {
    const id = ++seq.current;
    if (mode === 'load') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (id !== seq.current) return;
      hasData.current = true;
      setData(result);
      setError(null);
    } catch (e) {
      if (id === seq.current) setError(e);
    } finally {
      if (id === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  const lastKey = useRef(resetKey);
  useEffect(() => {
    if (lastKey.current !== resetKey) {
      lastKey.current = resetKey;
      hasData.current = false;
      setData(null);
      setError(null);
    }
    run(hasData.current ? 'silent' : 'load');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is forwarded from the caller, like useEffect's.
  }, [...deps, resetKey]);

  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current) run('silent');
    wasOnline.current = online;
  }, [online, run]);

  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) run('silent');
      focusedOnce.current = true;
    }, [run]),
  );

  const reload = useCallback(() => run('refresh'), [run]);
  const refetch = useCallback(() => run('silent'), [run]);
  const retry = useCallback(() => run('load'), [run]);

  return { data, error, loading: loading && data === null, refreshing, reload, refetch, retry, setData };
}
