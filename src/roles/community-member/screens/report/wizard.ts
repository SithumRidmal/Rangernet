import type { WizardStep } from '../../models/CommunityReport';
import type { CommunityStackParamList } from '../../navigation/types';

export const WIZARD_TOTAL = 4;
export const WIZARD_CONTEXT = 'Report conflict';

export const STEP_ROUTE: Record<WizardStep, 'ReportType' | 'ReportLocation' | 'ReportDetails'> = {
  type: 'ReportType',
  location: 'ReportLocation',
  details: 'ReportDetails',
};

export type WizardRoute = keyof Pick<CommunityStackParamList, 'ReportType' | 'ReportLocation' | 'ReportDetails'>;
