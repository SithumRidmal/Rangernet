import { useEffect, useRef } from 'react';
import { supabase } from '@shared/lib/supabase';
import { newId } from '@shared/utils/id';

type Table = 'community_reports' | 'response_assignments';

/** Refetches (debounced) when rows the CLO can see change; RLS applies to realtime too. */
export function useRealtimeRefresh(tables: readonly Table[], onChange: () => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });
  const key = tables.join(',');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase.channel(`clo:${key}:${newId()}`);
    key.split(',').forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => cb.current(), 600);
      });
    });
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [key]);
}
