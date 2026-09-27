import type { RoleModule } from '@shared/types/RoleModule';
import { SupervisorNavigator } from './navigation/SupervisorNavigator';

export const parkSupervisorModule: RoleModule = {
  Navigator: SupervisorNavigator,
  needsFieldSetup: false,
};
