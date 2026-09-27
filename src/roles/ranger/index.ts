import type { RoleModule } from '@shared/types/RoleModule';
import { RangerNavigator } from './navigation/RangerNavigator';
import { registerRangerSync } from './sync/registerRangerSync';

export const rangerModule: RoleModule = {
  Navigator: RangerNavigator,
  registerSync: registerRangerSync,
  needsFieldSetup: true,
};
