import type { AppRole } from '@shared/types';
import type { RoleModule } from '@shared/types/RoleModule';
import { rangerModule } from '../roles/ranger';
import { parkSupervisorModule } from '../roles/park-supervisor';
import { communityMemberModule } from '../roles/community-member';
import { communityLiaisonOfficerModule } from '../roles/community-liaison-officer';
import { parkManagerModule } from '../roles/park-manager';

export const ROLE_MODULES: Record<AppRole, RoleModule> = {
  ranger: rangerModule,
  park_supervisor: parkSupervisorModule,
  community_member: communityMemberModule,
  community_liaison_officer: communityLiaisonOfficerModule,
  park_manager: parkManagerModule,
};

let registered = false;

/** Sync handlers are registered for every role so queued records survive a role switch on a shared device. */
export function registerAllSyncHandlers() {
  if (registered) return;
  registered = true;
  Object.values(ROLE_MODULES).forEach((m) => m.registerSync?.());
}
