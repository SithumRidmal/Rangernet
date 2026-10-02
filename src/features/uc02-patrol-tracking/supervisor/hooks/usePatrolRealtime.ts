import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@shared/lib/supabase';

let channelSeq = 0;

/**
 * Refetches when any patrol row changes (realtime) and, while the screen is focused,
 * polls so the last known ranger positions stay current (waypoints are not broadcast).
 */
export function usePatrolRealtime(reload: () => Promise<void>, pollMs?: number) {
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`supervisor-patrols-${++channelSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patrols' }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => reloadRef.current(), 700);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!pollMs) return undefined;
      const t = setInterval(() => reloadRef.current(), pollMs);
      return () => clearInterval(t);
    }, [pollMs]),
  );
}
