import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/Toast';
import type { AppNotification } from '../types';

type NotificationsContextValue = {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  /** Increments whenever a realtime notification arrives, so dashboards can refetch. */
  tick: number;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const NO_ITEMS: AppNotification[] = [];

export function NotificationsProvider({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  // Items are tagged with the user they belong to so a sign-out / account switch never shows stale notifications.
  const [store, setStore] = useState<{ userId: string | null; items: AppNotification[] }>({ userId: null, items: NO_ITEMS });
  const items = store.userId === userId ? store.items : NO_ITEMS;
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const toast = useToast();

  const setItems = useCallback(
    (next: (prev: AppNotification[]) => AppNotification[]) =>
      setStore((s) => ({ userId, items: next(s.userId === userId ? s.items : NO_ITEMS) })),
    [userId],
  );

  const fetchItems = useCallback(async () => {
    if (!userId) return null;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    return (data as AppNotification[] | null) ?? null;
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = await fetchItems();
    if (data) setItems(() => data);
    setLoading(false);
  }, [userId, fetchItems, setItems]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchItems().then((data) => {
      if (alive && data) setItems(() => data);
    });
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => [n, ...prev.filter((p) => p.id !== n.id)]);
          setTick((t) => t + 1);
          toast.show(n.title, n.kind === 'RESPONSE' || n.kind === 'DUPLICATE' ? 'warn' : 'default');
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, [userId, fetchItems, setItems, toast]);

  const markRead = useCallback(
    async (id: string) => {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
      await supabase.from('notifications').update({ read_at: now }).eq('id', id);
    },
    [setItems],
  );

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    await supabase.from('notifications').update({ read_at: now }).eq('user_id', userId).is('read_at', null);
  }, [userId, setItems]);

  const value = useMemo(
    () => ({
      items,
      unread: items.filter((n) => !n.read_at).length,
      loading,
      refresh,
      markRead,
      markAllRead,
      tick,
    }),
    [items, loading, refresh, markRead, markAllRead, tick],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
