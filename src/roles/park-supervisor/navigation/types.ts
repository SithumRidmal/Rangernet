import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SharedStackParamList } from '@shared/navigation/types';
import type { PatrolStatus } from '../services/rows';

export type SupervisorTabParamList = {
  Dashboard: undefined;
  Patrols: { tab?: PatrolStatus } | undefined;
  Rangers: undefined;
  Coverage: undefined;
  More: undefined;
};

export type PatrolSavedParams = {
  patrolId: string;
  mode: 'assigned' | 'updated';
  title: string;
  rangerName: string;
  scheduledFor: string | null;
  waypointCount: number;
  plannedDistanceKm: number | null;
};

export type SupervisorStackParamList = SharedStackParamList & {
  Tabs: NavigatorScreenParams<SupervisorTabParamList> | undefined;
  PatrolDetail: { patrolId: string };
  PatrolForm: { patrolId?: string; rangerId?: string; zoneId?: string } | undefined;
  PatrolSaved: PatrolSavedParams;
  RangerDetail: { rangerId: string };
  Incidents: undefined;
  IncidentDetail: { incidentId: string };
};

export type SupervisorScreenProps<K extends keyof SupervisorStackParamList> = NativeStackScreenProps<
  SupervisorStackParamList,
  K
>;

export function useSupervisorNavigation() {
  return useNavigation<NativeStackNavigationProp<SupervisorStackParamList>>();
}
