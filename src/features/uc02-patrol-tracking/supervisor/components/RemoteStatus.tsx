import React from 'react';
import { CloudOffIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react-native';
import { EmptyState, LoadingBlock, Notice } from '@shared/components';
import { useSync } from '@shared/sync/SyncProvider';
import { relativeTime } from '@shared/utils/format';
import type { RemoteData } from '../hooks/useRemoteData';

/**
 * Renders loading / error / offline placeholders until data exists, then the children
 * with a notice when the shown data is the last copy saved on the device.
 */
export function RemoteStatus<T>({
  remote,
  loadingLabel = 'Loading…',
  children,
}: {
  remote: RemoteData<T>;
  loadingLabel?: string;
  children: (data: T) => React.ReactNode;
}) {
  const { online } = useSync();
  if (remote.data === null) {
    if (remote.loading) return <LoadingBlock label={loadingLabel} />;
    return (
      <EmptyState
        icon={online ? TriangleAlertIcon : CloudOffIcon}
        tone={online ? 'critical' : 'warn'}
        title={online ? 'Could not load data' : 'You are offline'}
        message={
          online
            ? remote.error ?? 'Something went wrong. Please try again.'
            : 'Supervisor data is loaded from the operations server. Connect to a network and try again.'
        }
        actionLabel="Try again"
        onAction={remote.reload}
      />
    );
  }
  return (
    <>
      {remote.stale ? (
        <Notice
          tone="warn"
          icon={online ? RefreshCwIcon : CloudOffIcon}
          title={online ? 'Could not refresh' : 'Offline – showing saved data'}
          message={`${online && remote.error ? `${remote.error} ` : ''}Last updated ${relativeTime(remote.savedAt)}.`}
          action="Retry"
          onAction={remote.reload}
          style={{ marginBottom: 12 }}
        />
      ) : null}
      {children(remote.data)}
    </>
  );
}
