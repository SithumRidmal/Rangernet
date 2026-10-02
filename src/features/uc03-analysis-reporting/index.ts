import type { RoleModule } from '@shared/types/RoleModule';
import { ParkManagerNavigator } from './navigation/ParkManagerNavigator';

export const parkManagerModule: RoleModule = {
  Navigator: ParkManagerNavigator,
  needsFieldSetup: false,
};
