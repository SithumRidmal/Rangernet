import React from 'react';
import { CloudOffIcon } from 'lucide-react-native';
import { SuccessScreen } from '@shared/components';
import { formatCode, formatDateTime } from '@shared/utils/format';
import { patrolTracker } from '@features/uc02-patrol-tracking/ranger/services/PatrolTracker';
import type { RangerScreenProps } from '@navigation/ranger/navigation/types';

/** UC-01 step 12: confirmation that the incident was recorded (or stored as Pending Synchronization). */
export function IncidentSuccessScreen({ navigation, route }: RangerScreenProps<'IncidentSuccess'>) {
  const p = route.params;
  const code = p.incidentNo ? formatCode('INC', p.incidentNo) : 'Pending number';
  const onPatrol = patrolTracker.isActive;

  return (
    <SuccessScreen
      tone={p.pending ? 'warn' : 'ok'}
      icon={p.pending ? CloudOffIcon : undefined}
      title={p.pending ? 'Incident saved on this device' : 'Incident successfully recorded'}
      message={
        p.pending
          ? 'There is no network connection, so the incident and its photographs are stored locally as Pending Synchronization. They will be sent automatically when connectivity returns.'
          : `${code} has been stored in the Central Operations System and your supervisor has been notified.`
      }
      meta={[
        { label: 'Incident', value: code },
        { label: 'Type', value: p.typeName },
        { label: 'Recorded', value: formatDateTime(p.reportedAt) },
        { label: 'Photos', value: String(p.photoCount) },
        { label: 'Status', value: p.pending ? 'Pending Synchronization' : 'Reported' },
      ]}
      primaryLabel="View incident"
      onPrimary={() => navigation.replace('IncidentDetail', { incidentId: p.incidentId })}
      secondaryLabel={onPatrol ? 'Back to patrol' : 'Done'}
      onSecondary={() => (onPatrol ? navigation.popTo('ActivePatrol') : navigation.goBack())}
    />
  );
}
