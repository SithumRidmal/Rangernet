import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useProfile } from '@shared/auth/AuthProvider';
import { useNotifications } from '@shared/notifications/NotificationsProvider';
import { localStore, type OutboxItem } from '@shared/sync/LocalStorage';
import { useSync } from '@shared/sync/SyncProvider';
import { getErrorMessage } from '@shared/utils/errors';
import { CommunityReport } from '../models/CommunityReport';
import { fetchMyReports, fetchReport, readCachedReports } from './ReportRepository';
import type { CommunityReportPayload } from './types';

export type ReportListItem =
  | { source: 'server'; report: CommunityReport }
  | { source: 'local'; report: CommunityReport; outbox: OutboxItem<CommunityReportPayload> };

export type ReportCounts = { submitted: number; inProgress: number; resolved: number; pendingSync: number };

async function readLocal(ownerId: string): Promise<OutboxItem<CommunityReportPayload>[]> {
  const items = await localStore.retrieveCommunityReport<CommunityReportPayload>();
  return items.filter((i) => i.payload.ownerId === ownerId);
}

/** Merges the member's reports from Supabase with the reports still waiting in Local Storage. */
export function useMyReports() {
  const profile = useProfile();
  const { version } = useSync();
  const { tick } = useNotifications();
  const [server, setServer] = useState<CommunityReport[]>([]);
  const [local, setLocal] = useState<OutboxItem<CommunityReportPayload>[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [localResult] = await Promise.allSettled([
      readLocal(profile.id).then(setLocal),
      fetchMyReports(profile.id)
        .then((rows) => {
          setServer(rows.map((r) => CommunityReport.fromRow(r)));
          setError(null);
          setCachedAt(null);
        })
        .catch(async (e: unknown) => {
          const cached = await readCachedReports(profile.id);
          if (cached) {
            setServer(cached.rows.map((r) => CommunityReport.fromRow(r)));
            setCachedAt(cached.savedAt);
          }
          setError(getErrorMessage(e));
        }),
    ]);
    if (localResult.status === 'rejected') setLocal([]);
    setLoading(false);
  }, [profile.id]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- also reload when the outbox changes or a notification arrives.
    }, [load, version, tick]),
  );

  const items = useMemo<ReportListItem[]>(() => {
    const serverIds = new Set(server.map((r) => r.reportId));
    const pending: ReportListItem[] = local
      .filter((o) => !serverIds.has(o.payload.reportId))
      .map((o) => ({ source: 'local', report: CommunityReport.fromPayload(o.payload), outbox: o }));
    const delivered: ReportListItem[] = server.map((r) => ({ source: 'server', report: r }));
    return [...pending, ...delivered].sort((a, b) => b.report.reportedAt.localeCompare(a.report.reportedAt));
  }, [server, local]);

  const counts = useMemo<ReportCounts>(
    () => ({
      submitted: server.length,
      inProgress: server.filter((r) => r.isOpen()).length,
      resolved: server.filter((r) => r.isResolved()).length,
      pendingSync: items.filter((i) => i.source === 'local').length,
    }),
    [server, items],
  );

  return { items, counts, loading, refreshing, error, cachedAt, refresh };
}

export type ReportDetailState =
  | { kind: 'local'; report: CommunityReport; outbox: OutboxItem<CommunityReportPayload> }
  | { kind: 'server'; report: CommunityReport; cached: boolean };

/** Loads one report: from Local Storage while pending, otherwise from Supabase (cached copy when offline). */
export function useReportDetail(reportId: string) {
  const profile = useProfile();
  const { version } = useSync();
  const { tick } = useNotifications();
  const [state, setState] = useState<ReportDetailState | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const localItem = (await readLocal(profile.id).catch(() => [])).find((o) => o.payload.reportId === reportId);
      if (localItem) {
        setState({ kind: 'local', report: CommunityReport.fromPayload(localItem.payload), outbox: localItem });
        setError(null);
        return;
      }
      try {
        const row = await fetchReport(reportId);
        if (row) {
          setState({ kind: 'server', report: CommunityReport.fromRow(row), cached: false });
          setError(null);
        } else {
          setState(null);
          setError('This report could not be found.');
        }
      } catch (e) {
        const cached = (await readCachedReports(profile.id))?.rows.find((r) => r.report_id === reportId);
        if (cached) setState({ kind: 'server', report: CommunityReport.fromRow(cached), cached: true });
        setError(getErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [profile.id, reportId]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- also reload when the outbox changes or a notification arrives.
    }, [load, version, tick]),
  );

  return { state, loading, refreshing, error, refresh };
}
