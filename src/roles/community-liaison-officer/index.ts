import type { RoleModule } from '@shared/types/RoleModule';
import { CloNavigator } from './navigation/CloNavigator';

/** Online-only role: no offline records, so no sync handlers are registered. */
export const communityLiaisonOfficerModule: RoleModule = {
  Navigator: CloNavigator,
  needsFieldSetup: false,
};
