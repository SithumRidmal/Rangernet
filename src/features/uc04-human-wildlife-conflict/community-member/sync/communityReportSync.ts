import { registerSyncHandler } from '@shared/sync/SynchronizationService';
import { assertRecordOwner } from '@shared/lib/session';
import { CommunityReport } from '../models/CommunityReport';
import { reportController } from '../services/ReportController';
import type { CommunityReportPayload } from '../services/types';

/** Delivers community reports stored offline (UC-04 offline storage / sync failure -> retry). */
export function registerCommunityReportSync(): void {
  registerSyncHandler<CommunityReportPayload>('community_report', 'create', async (item) => {
    await assertRecordOwner(item.payload.ownerId);
    const report = CommunityReport.fromPayload(item.payload);
    await report.submitReport(item.payload.ownerId, true);
    reportController.discardLocalPhotos(report);
  });
}
