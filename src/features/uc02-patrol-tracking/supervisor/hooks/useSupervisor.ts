import { useMemo } from 'react';
import { useProfile } from '@shared/auth/AuthProvider';
import { ParkSupervisor } from '../models';

export function useSupervisor(): ParkSupervisor {
  const profile = useProfile();
  return useMemo(() => ParkSupervisor.fromProfile(profile), [profile]);
}
