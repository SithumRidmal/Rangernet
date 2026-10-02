import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { useSync } from '@shared/sync/SyncProvider';

/** Reloads on screen focus, when a realtime notification arrives and when the connection returns. */
export function useAutoReload(reload: () => Promise<void>) {
  const { tick } = useNotifications();
  const { online } = useSync();
  const lastTick = useRef(tick);
  const wasOnline = useRef(online);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  useEffect(() => {
    if (tick !== lastTick.current) {
      lastTick.current = tick;
      reload();
    }
  }, [tick, reload]);

  useEffect(() => {
    if (online && !wasOnline.current) reload();
    wasOnline.current = online;
  }, [online, reload]);
}
