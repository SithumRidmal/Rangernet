import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

/**
 * Screens every role stack registers under these exact names, so shared UI
 * (offline banner, bell button, More screen) can navigate to them.
 */
export type SharedStackParamList = {
  SyncCenter: undefined;
  Notifications: undefined;
  Profile: undefined;
};

export const SHARED_ROUTES = {
  SyncCenter: 'SyncCenter',
  Notifications: 'Notifications',
  Profile: 'Profile',
} as const;

export function useSharedNavigation() {
  return useNavigation<NativeStackNavigationProp<SharedStackParamList>>();
}
