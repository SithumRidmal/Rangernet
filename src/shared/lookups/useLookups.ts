import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet } from '../sync/localDb';
import type { LookupType, Park, Zone } from '../types';

export type Lookups = {
  incidentTypes: LookupType[];
  conflictTypes: LookupType[];
  parks: Park[];
  zones: Zone[];
};

/** Same values as the seed data in the migration, used before the first sync. */
const DEFAULTS: Lookups = {
  incidentTypes: [
    { type_id: 1, type_name: 'Snare' },
    { type_id: 2, type_name: 'Carcass' },
    { type_id: 3, type_name: 'Illegal Campsite' },
    { type_id: 4, type_name: 'Footprints' },
  ],
  conflictTypes: [
    { type_id: 1, type_name: 'Elephant Sighting' },
    { type_id: 2, type_name: 'Crop-Raiding' },
    { type_id: 3, type_name: 'Animal Entering Farmland' },
    { type_id: 4, type_name: 'Animal Near Settlement' },
  ],
  parks: [],
  zones: [],
};

const CACHE_KEY = 'lookups:v1';
let memory: Lookups | null = null;

export async function loadLookups(force = false): Promise<Lookups> {
  if (memory && !force) return memory;
  try {
    const [it, ct, parks, zones] = await Promise.all([
      supabase.from('incident_types').select('type_id, type_name').order('type_id'),
      supabase.from('conflict_types').select('type_id, type_name').order('type_id'),
      supabase.from('parks').select('*').order('name'),
      supabase.from('zones').select('*').order('name'),
    ]);
    if (it.error || ct.error || parks.error || zones.error) throw new Error('lookup fetch failed');
    memory = {
      incidentTypes: (it.data as LookupType[]).length ? (it.data as LookupType[]) : DEFAULTS.incidentTypes,
      conflictTypes: (ct.data as LookupType[]).length ? (ct.data as LookupType[]) : DEFAULTS.conflictTypes,
      parks: parks.data as Park[],
      zones: zones.data as Zone[],
    };
    await cacheSet(CACHE_KEY, memory);
    return memory;
  } catch {
    memory = (await cacheGet<Lookups>(CACHE_KEY)) ?? memory ?? DEFAULTS;
    return memory;
  }
}

export function useLookups() {
  const [lookups, setLookups] = useState<Lookups>(memory ?? DEFAULTS);
  const [loading, setLoading] = useState(!memory);

  const reload = useCallback(async (force = true) => {
    setLoading(true);
    setLookups(await loadLookups(force));
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    loadLookups().then((l) => {
      if (alive) {
        setLookups(l);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const parkName = useCallback((id: string | null | undefined) => lookups.parks.find((p) => p.park_id === id)?.name ?? '—', [lookups]);
  const zoneName = useCallback((id: string | null | undefined) => lookups.zones.find((z) => z.zone_id === id)?.name ?? null, [lookups]);
  const incidentTypeName = useCallback(
    (id: number | null | undefined) => lookups.incidentTypes.find((t) => t.type_id === id)?.type_name ?? 'Incident',
    [lookups],
  );
  const conflictTypeName = useCallback(
    (id: number | null | undefined) => lookups.conflictTypes.find((t) => t.type_id === id)?.type_name ?? 'Conflict',
    [lookups],
  );

  return { ...lookups, loading, reload, parkName, zoneName, incidentTypeName, conflictTypeName };
}
