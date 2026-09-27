import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SharedStackParamList } from '@shared/navigation/types';
import type { ReportFilter } from '../services/reportService';

export type CloTabParamList = {
  Dashboard: undefined;
  Reports: { filter?: ReportFilter; at?: number } | undefined;
  Responses: undefined;
  More: undefined;
};

export type CloStackParamList = SharedStackParamList & {
  Tabs: NavigatorScreenParams<CloTabParamList> | undefined;
  ReportReview: { reportId: string };
  AssignRanger: { reportId: string };
  ResponseCoordinated: {
    assignmentId: string;
    reportCode: string;
    rangerName: string;
    assignedAt: string;
    reassigned: boolean;
  };
  ResponseTracking: { assignmentId: string };
};

export type CloStackScreenProps<T extends keyof CloStackParamList> = NativeStackScreenProps<CloStackParamList, T>;
export type CloNavigation = NativeStackNavigationProp<CloStackParamList>;
