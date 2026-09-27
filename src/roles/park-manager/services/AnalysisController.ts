import { getErrorMessage } from '@shared/utils/errors';
import { newId } from '@shared/utils/id';
import type { Lookups } from '@shared/lookups/useLookups';
import { Analytics } from '../models/Analytics';
import { DataRetrievalError, dataRepository, type DataRepository } from '../models/DataRepository';
import type {
  AnalysisContext,
  AnalysisLocation,
  AnalysisResults,
  AnalysisSummary,
  AnalysisType,
  DateRange,
  FilterErrors,
  ParkComparison,
} from '../models/types';
import { analysisEngine, type AnalysisEngine } from './AnalysisEngine';
import { daysBetween, parseLocalDate, startOfDay } from './dates';

export type AnalysisStep = 'validate' | 'retrieve' | 'analyse' | 'prepare';

export const ANALYSIS_STEPS: { key: AnalysisStep; label: string }[] = [
  { key: 'validate', label: 'Validating filters' },
  { key: 'retrieve', label: 'Retrieving data' },
  { key: 'analyse', label: 'Analysing trends & hotspots' },
  { key: 'prepare', label: 'Preparing results' },
];

const MAX_RANGE_DAYS = 731;

export class FilterValidationError extends Error {
  constructor(readonly errors: FilterErrors) {
    super(Object.values(errors).filter(Boolean).join(' '));
    this.name = 'FilterValidationError';
  }
}

/** UC-03 exception "No Data": the filters matched no records. */
export class NoDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoDataError';
  }
}

/** UC-03 exception "System Error": analysis or storing the results failed. */
export class AnalysisSystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisSystemError';
  }
}

export type SubmitOptions = {
  requestedBy: string;
  lookups: Pick<Lookups, 'parks' | 'zones' | 'incidentTypes' | 'conflictTypes'>;
  online: boolean;
  onStep?: (step: AnalysisStep) => void;
};

const NO_DATA_NOUN: Record<AnalysisType, string> = {
  INCIDENT: 'incident records',
  PATROL_COVERAGE: 'patrols',
  CONFLICT: 'conflict reports',
};

const MIN_STEP_MS = 350;
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * AnalysisController (sequence diagram): receives the analysis request from the
 * Operations Dashboard screens, validates it, retrieves and analyses the data and
 * keeps the latest results in memory for the results / report screens.
 */
export class AnalysisController {
  private readonly cache = new Map<string, AnalysisResults>();

  constructor(
    private readonly repository: DataRepository,
    private readonly engine: AnalysisEngine,
  ) {}

  validateFiltersAndCriteria(
    location: AnalysisLocation,
    dateRange: DateRange,
    zones: { zone_id: string; park_id: string }[] = [],
    today = new Date(),
  ): FilterErrors {
    const errors: FilterErrors = {};
    if (location.parkIds.length === 0) errors.parks = 'Select at least one park.';
    if (location.zoneId) {
      const zone = zones.find((z) => z.zone_id === location.zoneId);
      if (location.parkIds.length > 1) errors.location = 'A single location cannot be used for a combined analysis.';
      else if (zone && !location.parkIds.includes(zone.park_id)) errors.location = 'The location is not in the selected park.';
    }
    const from = parseLocalDate(dateRange.from);
    const to = parseLocalDate(dateRange.to);
    if (!from || !to) errors.dateRange = 'Select a valid start and end date.';
    else if (from > to) errors.dateRange = 'The start date must be on or before the end date.';
    else if (to > startOfDay(today)) errors.dateRange = 'The end date cannot be in the future.';
    else if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) errors.dateRange = 'The date range cannot be longer than 2 years.';
    return errors;
  }

  async submitAnalysisRequest(
    type: AnalysisType,
    location: AnalysisLocation,
    dateRange: DateRange,
    options: SubmitOptions,
  ): Promise<AnalysisResults> {
    const step = async (s: AnalysisStep) => {
      options.onStep?.(s);
      await pause(MIN_STEP_MS);
    };

    await step('validate');
    const errors = this.validateFiltersAndCriteria(location, dateRange, options.lookups.zones);
    if (Object.keys(errors).length) throw new FilterValidationError(errors);

    await step('retrieve');
    if (!options.online) {
      throw new DataRetrievalError('You are offline. Data analysis needs a connection to the park server.');
    }
    const isCombined = location.parkIds.length > 1;
    const zoneId = isCombined ? null : location.zoneId;
    const ctx: AnalysisContext = { ...options.lookups, parkIds: location.parkIds, zoneId, dateRange };
    const analytics = new Analytics(
      { analysisId: newId(), analysisType: type, dateRange, parkIds: location.parkIds, zoneId },
      this.repository,
      this.engine,
      ctx,
    );

    let summary: AnalysisSummary;
    let comparison: ParkComparison[] | null = null;
    try {
      if (isCombined) {
        const data = await this.repository.retrieveMultiParkData(location.parkIds, type, null, dateRange);
        await step('analyse');
        ({ summary, comparison } = this.engine.generateCombinedParkAnalysis(data, ctx));
      } else {
        let retrieved = false;
        const onRetrieved = () => {
          retrieved = true;
          options.onStep?.('analyse');
        };
        if (type === 'INCIDENT') summary = await analytics.analyzeIncidents(onRetrieved);
        else if (type === 'PATROL_COVERAGE') summary = await analytics.analyzePatrolCoverage(onRetrieved);
        else summary = await analytics.analyzeConflictTrends(onRetrieved);
        if (retrieved) await pause(MIN_STEP_MS);
      }
    } catch (e) {
      if (e instanceof DataRetrievalError) throw e;
      throw new AnalysisSystemError(getErrorMessage(e, 'The analysis could not be completed.'));
    }

    if (summary.total === 0) {
      throw new NoDataError(`No ${NO_DATA_NOUN[type]} were found for the selected park, location and date range.`);
    }

    await step('prepare');
    const parkName = (id: string) => options.lookups.parks.find((p) => p.park_id === id)?.name ?? 'Unknown park';
    const results: AnalysisResults = {
      analysisId: analytics.analysisId,
      analysisType: type,
      parkIds: location.parkIds,
      parkNames: location.parkIds.map(parkName),
      zoneId,
      zoneName: zoneId ? (options.lookups.zones.find((z) => z.zone_id === zoneId)?.name ?? null) : null,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      isCombined,
      recordCount: summary.total,
      analysedAt: new Date().toISOString(),
      summary,
      comparison,
    };
    try {
      await analytics.save(options.requestedBy, results);
    } catch (e) {
      throw new AnalysisSystemError(getErrorMessage(e, 'The analysis results could not be stored.'));
    }
    this.cache.set(results.analysisId, results);
    return results;
  }

  /** Results of an earlier run: from memory, otherwise from the stored `analytics` row. */
  async getAnalysisResults(analysisId: string): Promise<AnalysisResults | null> {
    const cached = this.cache.get(analysisId);
    if (cached) return cached;
    try {
      const loaded = await Analytics.load(analysisId);
      if (loaded) this.cache.set(analysisId, loaded);
      return loaded;
    } catch (e) {
      throw new DataRetrievalError(getErrorMessage(e, 'Could not load the analysis results.'));
    }
  }
}

export const analysisController = new AnalysisController(dataRepository, analysisEngine);
