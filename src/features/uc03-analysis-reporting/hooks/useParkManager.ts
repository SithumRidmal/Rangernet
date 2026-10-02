import { useMemo } from 'react';
import { useProfile } from '@shared/auth/AuthProvider';
import { ParkManager } from '../models/ParkManager';

export function useParkManager(): ParkManager {
  const profile = useProfile();
  return useMemo(() => ParkManager.fromProfile(profile), [profile]);
}
