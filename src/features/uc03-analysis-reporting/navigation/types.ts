import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SharedStackParamList } from '@shared/navigation/types';
import type { AnalysisRequest, AnalysisType } from '../models/types';

export type ParkManagerTabParamList = {
  Home: undefined;
  Analysis: undefined;
  Reports: undefined;
  More: undefined;
};

export type ParkManagerStackParamList = SharedStackParamList & {
  Tabs: NavigatorScreenParams<ParkManagerTabParamList> | undefined;
  AnalysisFilters: { type: AnalysisType };
  Analyzing: { request: AnalysisRequest };
  AnalysisResults: { analysisId: string };
  ReportGenerate: { analysisId: string };
  ReportDetail: { reportId: string };
};

export type ParkManagerNavigation = NativeStackNavigationProp<ParkManagerStackParamList>;

export function useParkManagerNavigation() {
  return useNavigation<ParkManagerNavigation>();
}
