import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useProfile } from '@shared/auth/AuthProvider';
import type { Incident } from '../models/Incident';
import type { IncidentType } from '../models/IncidentType';
import { Ranger } from '../models/Ranger';

type DraftContextValue = {
  incident: Incident | null;
  /** createIncident(type) - starts a new report, or changes the type of the current draft. */
  begin: (type: IncidentType) => Incident;
  update: (mutate: (incident: Incident) => void) => void;
  /** Clears the draft; unsent photos are deleted from the device unless the report was stored. */
  reset: (opts?: { keepPhotos?: boolean }) => void;
  version: number;
};

const DraftContext = createContext<DraftContextValue | null>(null);

export function IncidentDraftProvider({ children }: { children: React.ReactNode }) {
  const profile = useProfile();
  // The ref is the source of truth so callbacks always act on the live draft (even from stale listeners);
  // the draft is mutated in place, so each change publishes a new snapshot with a bumped version.
  const ref = useRef<Incident | null>(null);
  const [snapshot, setSnapshot] = useState<{ incident: Incident | null; version: number }>({ incident: null, version: 0 });
  const bump = useCallback(() => {
    const incident = ref.current;
    setSnapshot((s) => ({ incident, version: s.version + 1 }));
  }, []);

  const begin = useCallback(
    (type: IncidentType) => {
      if (ref.current) ref.current.setType(type);
      else ref.current = Ranger.fromProfile(profile).reportIncident(type);
      bump();
      return ref.current;
    },
    [bump, profile],
  );

  const update = useCallback(
    (mutate: (incident: Incident) => void) => {
      if (!ref.current) return;
      mutate(ref.current);
      bump();
    },
    [bump],
  );

  const reset = useCallback(
    (opts?: { keepPhotos?: boolean }) => {
      if (ref.current && !opts?.keepPhotos) ref.current.photos.forEach((p) => p.discard());
      ref.current = null;
      bump();
    },
    [bump],
  );

  const { incident, version } = snapshot;
  const value = useMemo(() => ({ incident, begin, update, reset, version }), [incident, begin, update, reset, version]);
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useIncidentDraft() {
  const ctx = useContext(DraftContext);
  if (!ctx) throw new Error('useIncidentDraft must be used inside IncidentDraftProvider');
  return ctx;
}
