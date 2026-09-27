import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SharedStackParamList } from '@shared/navigation/types';

export type ReportFilter = 'All' | 'Pending Sync' | 'Open' | 'Resolved';

export type CommunityTabParamList = {
  Home: undefined;
  Report: undefined;
  MyReports: { filter?: ReportFilter } | undefined;
  More: undefined;
};

/** `editing` means the step was opened from the review screen and returns there when saved. */
export type WizardStepParams = { editing?: boolean } | undefined;

export type ReportSuccessParams = {
  mode: 'delivered' | 'stored';
  reportId: string;
  reportNo: number | null;
  typeName: string;
  reportedAt: string;
  photoCount: number;
  flaggedDuplicate: boolean;
  storedReason?: 'offline' | 'network';
};

export type CommunityStackParamList = SharedStackParamList & {
  Tabs: NavigatorScreenParams<CommunityTabParamList> | undefined;
  ReportType: WizardStepParams;
  ReportLocation: WizardStepParams;
  ReportDetails: WizardStepParams;
  ReportReview: undefined;
  ReportSuccess: ReportSuccessParams;
  SmsReport: undefined;
  ReportDetail: { reportId: string };
};

export type CommunityNavigation = NativeStackNavigationProp<CommunityStackParamList>;

export function useCommunityNavigation() {
  return useNavigation<CommunityNavigation>();
}
