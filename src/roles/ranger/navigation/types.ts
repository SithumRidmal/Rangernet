import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SharedStackParamList } from '@shared/navigation/types';
import type { PatrolSummary } from '../services/PatrolTracker';

export type RangerTabParamList = {
  Home: undefined;
  Patrols: undefined;
  Incidents: undefined;
  Responses: undefined;
  More: undefined;
};

export type RangerStackParamList = SharedStackParamList & {
  Tabs: NavigatorScreenParams<RangerTabParamList> | undefined;
  IncidentType: undefined;
  IncidentPhoto: undefined;
  IncidentLocation: undefined;
  IncidentDescription: undefined;
  IncidentReview: undefined;
  IncidentSuccess: {
    incidentId: string;
    incidentNo: number | null;
    pending: boolean;
    typeName: string;
    reportedAt: string;
    photoCount: number;
  };
  IncidentDetail: { incidentId: string };
  PatrolDetail: { patrolId: string };
  ActivePatrol: undefined;
  EndPatrol: { mode: 'complete' | 'early' };
  PatrolSummary: { summary: PatrolSummary };
  ResponseDetail: { assignmentId: string };
};

export type RangerScreenProps<T extends keyof RangerStackParamList> = NativeStackScreenProps<RangerStackParamList, T>;

export function useRangerNavigation() {
  return useNavigation<NativeStackNavigationProp<RangerStackParamList>>();
}
