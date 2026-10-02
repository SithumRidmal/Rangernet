import React from 'react';
import { CloudOffIcon, TriangleAlertIcon } from 'lucide-react-native';
import { EmptyState, Notice } from '@shared/components';
import { useSync } from '@shared/sync/SyncProvider';
import { getErrorMessage } from '@shared/utils/errors';

/** Full-screen error when nothing could be loaded (the CLO workspace is online-only). */
export function LoadError({ error, onRetry, title }: { error: unknown; onRetry: () => void; title?: string }) {
  const { online } = useSync();
  if (!online) {
    return (
      <EmptyState
        icon={CloudOffIcon}
        tone="warn"
        title="You're offline"
        message="Community reports and responses are only available online. Reconnect to continue."
        actionLabel="Try again"
        onAction={onRetry}
      />
    );
  }
  return (
    <EmptyState
      icon={TriangleAlertIcon}
      tone="critical"
      title={title ?? "Couldn't load data"}
      message={getErrorMessage(error)}
      actionLabel="Try again"
      onAction={onRetry}
    />
  );
}

/** Shown above stale data when a background refresh failed. */
export function RefreshError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { online } = useSync();
  return (
    <Notice
      tone="warn"
      icon={online ? TriangleAlertIcon : CloudOffIcon}
      title={online ? 'Could not refresh' : 'Offline – showing last loaded data'}
      message={online ? getErrorMessage(error) : 'Reconnect to see the latest reports and to take actions.'}
      action="Retry"
      onAction={onRetry}
      style={{ marginBottom: 12 }}
    />
  );
}
