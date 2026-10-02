import type { AppRole } from '@shared/types';
import type { RoleModule } from '@shared/types/RoleModule';
import { rangerModule } from '@navigation/ranger';
import { parkSupervisorModule } from '@features/uc02-patrol-tracking';
import { communityMemberModule, communityLiaisonOfficerModule } from '@features/uc04-human-wildlife-conflict';
import { parkManagerModule } from '@features/uc03-analysis-reporting';

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
