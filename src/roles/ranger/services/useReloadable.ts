import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@shared/utils/errors';

export type Fetched<T> = { data: T; fromCache: boolean; error?: string | null };

type State<T> = { data: T; fromCache: boolean; error: string | null; loaded: boolean };

/**
 * Loads `fetcher` on mount and whenever it or `trigger` changes. Background reloads keep the current data on
 * screen; only a manual `reload()` reports `loading` so pull-to-refresh shows its spinner.
 */
export function useReloadable<T>(fetcher: () => Promise<Fetched<T>>, initial: T, trigger: unknown) {
  const [state, setState] = useState<State<T>>({ data: initial, fromCache: false, error: null, loaded: false });
  const [refreshing, setRefreshing] = useState(false);

  const settle = useCallback(async (): Promise<(prev: State<T>) => State<T>> => {
    try {
      const r = await fetcher();
      return () => ({ data: r.data, fromCache: r.fromCache, error: r.error ?? null, loaded: true });
    } catch (e) {
      const error = getErrorMessage(e);
      return (prev) => ({ ...prev, error, loaded: true });
    }
  }, [fetcher]);

  useEffect(() => {
    let alive = true;
    void settle().then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, [settle, trigger]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    const next = await settle();
    setState(next);
    setRefreshing(false);
  }, [settle]);

  return { data: state.data, fromCache: state.fromCache, error: state.error, loading: !state.loaded || refreshing, reload };
}
