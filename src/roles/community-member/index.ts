import type { RoleModule } from '@shared/types/RoleModule';
import { CommunityMemberNavigator } from './navigation/CommunityMemberNavigator';
import { registerCommunityReportSync } from './sync/communityReportSync';

export const communityMemberModule: RoleModule = {
  Navigator: CommunityMemberNavigator,
  registerSync: registerCommunityReportSync,
  needsFieldSetup: true,
};
