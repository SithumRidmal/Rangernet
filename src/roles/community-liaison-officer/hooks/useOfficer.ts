import { useMemo } from 'react';
import { useProfile } from '@shared/auth/AuthProvider';
import { CommunityLiaisonOfficer } from '../models/CommunityLiaisonOfficer';

export function useOfficer(): CommunityLiaisonOfficer {
  const profile = useProfile();
  return useMemo(() => CommunityLiaisonOfficer.fromProfile(profile), [profile]);
}
