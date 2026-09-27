import React from 'react';
import { RecordCard } from '@shared/components';
import { useLookups } from '@shared/lookups/useLookups';
import { formatCode, relativeTime } from '@shared/utils/format';
import type { IncidentRow } from '../services/rows';

export const incidentCode = (i: IncidentRow) => formatCode('INC', i.incident_no);
export const incidentTitle = (i: IncidentRow) => i.type?.type_name ?? 'Incident';

export function IncidentCard({ incident, onPress }: { incident: IncidentRow; onPress: () => void }) {
  const { zoneName, parkName } = useLookups();
  const where = zoneName(incident.zone_id) ?? parkName(incident.park_id);
  const photos = incident.photos?.length ?? 0;
  return (
    <RecordCard
      code={incidentCode(incident)}
      title={incidentTitle(incident)}
      subtitle={`${where} · ${relativeTime(incident.reported_at)} · ${incident.ranger?.full_name ?? 'Ranger'}${photos ? ` · ${photos} photo${photos === 1 ? '' : 's'}` : ''}`}
      badges={[incident.status, incident.location?.manually_marked ? 'Manual' : 'GPS']}
      thumbTone={incident.status === 'Resolved' ? 'default' : 'critical'}
      onPress={onPress}
    />
  );
}
