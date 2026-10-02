import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '@shared/lib/supabase';
import { currentUserId } from '@shared/lib/session';
import { env } from '@shared/config/env';
import { getErrorMessage, unwrap } from '@shared/utils/errors';
import { formatCode } from '@shared/utils/format';
import { Report } from '../models/Report';
import type { AnalysisResults, ReportParameters, ReportRecord, ReportSummary } from '../models/types';
import { analysisEngine } from './AnalysisEngine';

/** UC-03 exception "Report Generation Failure". */
export class ReportGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportGenerationError';
  }
}

export class ReportDownloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportDownloadError';
  }
}

export type GeneratedReport = {
  record: ReportRecord;
  reportDownloadLink: string | null;
  numberOfPages: number;
  sizeBytes: number;
};

const BUCKET = env.conservationReportBucket;
const REPORT_COLUMNS =
  'report_id, report_no, analysis_id, manager_id, report_type, title, format, file_path, parameters, summary, generated_at, ' +
  'manager:profiles(full_name)';

function normalize(row: ReportRecord & { manager: ReportRecord['manager'] | ReportRecord['manager'][] }): ReportRecord {
  const manager = Array.isArray(row.manager) ? (row.manager[0] ?? null) : row.manager;
  return { ...row, parameters: row.parameters ?? {}, summary: row.summary ?? {}, manager };
}

function removeLocal(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Cache files are cleaned up by the OS as well.
  }
}

/**
 * ReportService (sequence diagram): generateConservationReport(analysisResults, 'PDF')
 * returns the reportDownloadLink; downloadReport(reportId) saves and opens the PDF.
 */
export class ReportService {
  async generateConservationReport(
    analysisResults: AnalysisResults,
    format: 'PDF',
    preparedBy: { managerId: string; name: string },
  ): Promise<GeneratedReport> {
    const uid = await currentUserId();
    if (!uid) throw new ReportGenerationError('Your session has expired. Sign in again to generate reports.');

    const report = Report.forAnalysis(analysisResults);
    let pdf: { uri: string; numberOfPages: number };
    try {
      pdf = await report.generateReport(analysisResults, preparedBy.name || 'Park Manager');
    } catch (e) {
      throw new ReportGenerationError(getErrorMessage(e, 'The PDF document could not be created on this device.'));
    }

    const path = report.storagePath(uid);
    let sizeBytes = 0;
    try {
      const bytes = await new File(pdf.uri).arrayBuffer();
      sizeBytes = bytes.byteLength;
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
      if (error) throw new ReportGenerationError(`The report could not be uploaded: ${error.message}`);
    } catch (e) {
      removeLocal(pdf.uri);
      if (e instanceof ReportGenerationError) throw e;
      throw new ReportGenerationError(getErrorMessage(e, 'The report could not be uploaded.'));
    }
    removeLocal(pdf.uri);

    const parameters: ReportParameters = {
      analysis_type: analysisResults.analysisType,
      park_ids: analysisResults.parkIds,
      park_names: analysisResults.parkNames,
      zone_id: analysisResults.zoneId,
      zone_name: analysisResults.zoneName,
      date_from: analysisResults.dateFrom,
      date_to: analysisResults.dateTo,
      is_combined: analysisResults.isCombined,
    };
    const s = analysisResults.summary;
    const summary: ReportSummary = {
      record_count: analysisResults.recordCount,
      metrics: analysisEngine.keyMetrics(s),
      findings: analysisEngine.findings(analysisResults),
      hotspots:
        s.kind === 'PATROL_COVERAGE'
          ? []
          : s.hotspots.map((h) => ({ rank: h.rank, zone: h.zoneName, park: h.parkName, count: h.count, latitude: h.latitude, longitude: h.longitude })),
      pages: pdf.numberOfPages,
      size_bytes: sizeBytes,
    };

    let record: ReportRecord;
    try {
      const row = unwrap(
        await supabase
          .from('reports')
          .insert({
            report_id: report.reportId,
            analysis_id: analysisResults.analysisId,
            manager_id: uid,
            report_type: report.reportType,
            title: report.title,
            format,
            file_path: path,
            parameters,
            summary,
            generated_at: report.generatedAt,
          })
          .select(REPORT_COLUMNS)
          .single(),
      );
      record = normalize(row as unknown as Parameters<typeof normalize>[0]);
    } catch (e) {
      await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
      throw new ReportGenerationError(getErrorMessage(e, 'The report could not be saved.'));
    }

    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return { record, reportDownloadLink: signed?.signedUrl ?? null, numberOfPages: pdf.numberOfPages, sizeBytes };
  }

  /** Downloads the stored PDF into the cache directory and opens the system share / open sheet. */
  async downloadReport(reportId: string): Promise<string> {
    try {
      const row = unwrap(
        await supabase.from('reports').select('report_no, title, file_path').eq('report_id', reportId).maybeSingle(),
      ) as { report_no: number; title: string; file_path: string | null } | null;
      if (!row) throw new ReportDownloadError('This report no longer exists.');
      if (!row.file_path) throw new ReportDownloadError('This report has no PDF file.');

      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.file_path, 600);
      if (error || !data?.signedUrl) throw new ReportDownloadError(error?.message ?? 'Could not create a download link.');

      const target = new File(Paths.cache, `RangerNet-${formatCode('RPT', row.report_no)}.pdf`);
      if (target.exists) target.delete();
      const file = await File.downloadFileAsync(data.signedUrl, target, { idempotent: true });

      if (!(await Sharing.isAvailableAsync())) {
        throw new ReportDownloadError('Opening files is not available on this device.');
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: row.title });
      return file.uri;
    } catch (e) {
      if (e instanceof ReportDownloadError) throw e;
      throw new ReportDownloadError(getErrorMessage(e, 'The report could not be downloaded.'));
    }
  }

  async listReports(limit?: number): Promise<ReportRecord[]> {
    let q = supabase.from('reports').select(REPORT_COLUMNS).order('generated_at', { ascending: false });
    if (limit) q = q.limit(limit);
    const rows = unwrap(await q) as unknown as Parameters<typeof normalize>[0][];
    return (rows ?? []).map(normalize);
  }

  async getReport(reportId: string): Promise<ReportRecord | null> {
    const row = unwrap(await supabase.from('reports').select(REPORT_COLUMNS).eq('report_id', reportId).maybeSingle());
    return row ? normalize(row as unknown as Parameters<typeof normalize>[0]) : null;
  }

  /** Deletes the stored PDF and the report row (only the generating manager may do this). */
  async deleteReport(report: ReportRecord): Promise<void> {
    if (report.file_path) {
      const { error } = await supabase.storage.from(BUCKET).remove([report.file_path]);
      if (error) throw new Error(`The PDF could not be deleted: ${error.message}`);
    }
    unwrap(await supabase.from('reports').delete().eq('report_id', report.report_id));
  }
}

export const reportService = new ReportService();
