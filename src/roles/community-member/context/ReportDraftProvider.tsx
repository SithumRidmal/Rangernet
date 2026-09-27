import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CommunityReport, ValidationIssue, WizardStep } from '../models/CommunityReport';
import { reportController } from '../services/ReportController';

type ReportDraftValue = {
  /** The report being prepared in the wizard (null until the member starts one). */
  report: CommunityReport | null;
  issues: ValidationIssue[];
  hasProgress: boolean;
  update: (mutate: (r: CommunityReport) => void) => void;
  setIssues: (issues: ValidationIssue[]) => void;
  raise: (issue: ValidationIssue) => void;
  issueFor: (step: WizardStep) => string | null;
  clearIssue: (step: WizardStep) => void;
  /** Abandons the draft and deletes photos captured for it. */
  discard: () => void;
  /** Clears the draft after it was delivered or stored in Local Storage (photos are kept). */
  finish: () => void;
};

const ReportDraftContext = createContext<ReportDraftValue | null>(null);

export function ReportDraftProvider({ children }: { children: React.ReactNode }) {
  const [report, setReport] = useState<CommunityReport | null>(null);
  const [issues, setIssuesState] = useState<ValidationIssue[]>([]);

  const update = useCallback((mutate: (r: CommunityReport) => void) => {
    setReport((prev) => {
      const next = (prev ?? reportController.createReport()).clone();
      mutate(next);
      return next;
    });
  }, []);

  const setIssues = useCallback((next: ValidationIssue[]) => setIssuesState(next), []);
  const raise = useCallback(
    (issue: ValidationIssue) => setIssuesState((prev) => [...prev.filter((i) => i.step !== issue.step), issue]),
    [],
  );
  const clearIssue = useCallback((step: WizardStep) => setIssuesState((prev) => prev.filter((i) => i.step !== step)), []);
  const issueFor = useCallback((step: WizardStep) => issues.find((i) => i.step === step)?.message ?? null, [issues]);

  const discard = useCallback(() => {
    report?.photos.forEach((p) => p.removePhoto());
    setReport(null);
    setIssuesState([]);
  }, [report]);

  const finish = useCallback(() => {
    setReport(null);
    setIssuesState([]);
  }, []);

  const hasProgress = !!report && (!!report.conflictType || !!report.location || !!report.description.trim() || report.photos.length > 0);

  const value = useMemo<ReportDraftValue>(
    () => ({ report, issues, hasProgress, update, setIssues, raise, issueFor, clearIssue, discard, finish }),
    [report, issues, hasProgress, update, setIssues, raise, issueFor, clearIssue, discard, finish],
  );

  return <ReportDraftContext.Provider value={value}>{children}</ReportDraftContext.Provider>;
}

export function useReportDraft(): ReportDraftValue {
  const ctx = useContext(ReportDraftContext);
  if (!ctx) throw new Error('useReportDraft must be used inside ReportDraftProvider');
  return ctx;
}
