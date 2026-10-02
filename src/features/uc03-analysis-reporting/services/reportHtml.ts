import { formatDateTime } from '@shared/utils/format';
import { ANALYSIS_TYPE_LABELS, type AnalysisResults, type Datum, type Hotspot } from '../models/types';
import { analysisEngine, formatMetric } from './AnalysisEngine';
import { formatRange } from './dates';

const C = {
  forest: '#176B45',
  forestDark: '#0D5135',
  forestLight: '#EAF5EE',
  ink: '#17221C',
  muted: '#66736C',
  line: '#E2EAE5',
  crit: '#D84A4A',
  warn: '#E8A23A',
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function barList(title: string, data: Datum[], color = C.forest, unit = ''): string {
  if (!data.length) return '';
  const max = Math.max(...data.map((d) => d.value), 1);
  const rows = data
    .map(
      (d) => `
      <tr>
        <td class="bl-label">${esc(d.label)}</td>
        <td class="bl-bar"><div class="track"><div class="fill" style="width:${((d.value / max) * 100).toFixed(1)}%;background:${color}"></div></div></td>
        <td class="bl-val">${fmt(d.value)}${unit}</td>
      </tr>`,
    )
    .join('');
  return `<h3>${esc(title)}</h3><table class="barlist">${rows}</table>`;
}

function columnChart(title: string, data: Datum[], color = C.forest): string {
  if (!data.length) return '';
  const max = Math.max(...data.map((d) => d.value), 1);
  const every = Math.ceil(data.length / 12);
  const cols = data
    .map(
      (d, i) => `
      <td class="col">
        <div class="col-val">${d.value || ''}</div>
        <div class="col-bar" style="height:${Math.max((d.value / max) * 110, 2).toFixed(0)}px;background:${color}"></div>
        <div class="col-label">${i % every === 0 ? esc(d.label) : ''}</div>
      </td>`,
    )
    .join('');
  return `<h3>${esc(title)}</h3><table class="columns"><tr>${cols}</tr></table>`;
}

function hotspotTable(title: string, hotspots: Hotspot[], noun: string): string {
  if (!hotspots.length) return `<h3>${esc(title)}</h3><p class="muted">No located ${esc(noun)} in this range.</p>`;
  const rows = hotspots
    .map(
      (h) => `
      <tr>
        <td>#${h.rank}</td>
        <td>${esc(h.zoneName)}</td>
        <td>${esc(h.parkName)}</td>
        <td>${h.latitude.toFixed(4)}, ${h.longitude.toFixed(4)}</td>
        <td class="num">${h.count}</td>
        <td class="num">${fmt(h.share)}%</td>
      </tr>`,
    )
    .join('');
  return `<h3>${esc(title)}</h3>
    <table class="grid">
      <tr><th>Rank</th><th>Nearest zone</th><th>Park</th><th>Cell centre (lat, lng)</th><th class="num">${esc(noun)}</th><th class="num">Share</th></tr>
      ${rows}
    </table>
    <p class="muted small">Hotspots are ~1 km grid cells (0.01°) ranked by the number of located ${esc(noun)}.</p>`;
}

function typeSections(results: AnalysisResults): string {
  const s = results.summary;
  const trendTitle = `Trend (${s.trendBucket === 'day' ? 'daily' : s.trendBucket === 'week' ? 'weekly' : 'monthly'})`;
  if (s.kind === 'INCIDENT') {
    return [
      columnChart(trendTitle, s.trend, C.crit),
      barList('Incidents by type', s.byType),
      barList('Incidents by zone', s.byZone, C.warn),
      barList('Incidents by status', s.byStatus, C.forestDark),
      hotspotTable('Poaching hotspots', s.hotspots, 'incidents'),
    ].join('');
  }
  if (s.kind === 'PATROL_COVERAGE') {
    const zoneRows = s.coverageByZone
      .map(
        (z) => `<tr><td>${esc(z.zoneName)}</td><td>${esc(z.parkName)}</td><td class="num">${z.total}</td><td class="num">${z.completed}</td><td class="num">${z.avgCoverage === null ? '—' : `${fmt(z.avgCoverage)}%`}</td></tr>`,
      )
      .join('');
    const gapRows = s.gaps
      .map(
        (g) => `<tr><td>${esc(g.zoneName)}</td><td>${esc(g.parkName)}</td><td>${g.reason === 'NO_COMPLETED_PATROL' ? 'No completed patrol in range' : 'Average coverage below 50%'}</td><td class="num">${g.avgCoverage === null ? '—' : `${fmt(g.avgCoverage)}%`}</td></tr>`,
      )
      .join('');
    return [
      columnChart(trendTitle, s.trend),
      barList('Patrols by status', s.byStatus, C.forestDark),
      barList(
        'Average coverage by zone',
        s.coverageByZone.filter((z) => z.avgCoverage !== null).map((z) => ({ label: z.zoneName, value: z.avgCoverage ?? 0 })),
        C.forest,
        '%',
      ),
      `<h3>Coverage by zone</h3><table class="grid"><tr><th>Zone</th><th>Park</th><th class="num">Patrols</th><th class="num">Completed</th><th class="num">Avg coverage</th></tr>${zoneRows}</table>`,
      `<h3>Coverage gaps</h3>${
        s.gaps.length
          ? `<table class="grid"><tr><th>Zone</th><th>Park</th><th>Reason</th><th class="num">Avg coverage</th></tr>${gapRows}</table>`
          : '<p class="muted">No coverage gaps were identified.</p>'
      }`,
    ].join('');
  }
  return [
    columnChart(trendTitle, s.trend, C.warn),
    barList('Reports by conflict type', s.byType),
    barList('Reports by severity', s.bySeverity, C.crit),
    barList('Reports by channel', [
      { label: 'App', value: s.appCount },
      { label: 'SMS', value: s.smsCount },
    ], C.forestDark),
    barList('Reports by zone', s.byZone, C.warn),
    hotspotTable('Conflict hotspots', s.hotspots, 'reports'),
  ].join('');
}

function comparisonSection(results: AnalysisResults): string {
  if (!results.comparison?.length) return '';
  const labels = results.comparison[0].metrics.map((m) => m.label);
  const head = labels.map((l) => `<th class="num">${esc(l)}</th>`).join('');
  const rows = results.comparison
    .map((p) => `<tr><td>${esc(p.parkName)}</td>${p.metrics.map((m) => `<td class="num">${esc(formatMetric(m))}</td>`).join('')}</tr>`)
    .join('');
  return `<h2>Per-park comparison</h2><table class="grid"><tr><th>Park</th>${head}</tr>${rows}</table>`;
}

export type ReportHtmlInput = {
  reportRef: string;
  title: string;
  results: AnalysisResults;
  preparedBy: string;
  generatedAt: string;
};

/** Printable HTML for the conservation report (rendered to PDF with expo-print). */
export function buildConservationReportHtml({ reportRef, title, results, preparedBy, generatedAt }: ReportHtmlInput): string {
  const metrics = analysisEngine.keyMetrics(results.summary);
  const findings = analysisEngine.findings(results);
  const metricCells = metrics
    .map((m) => `<td class="metric"><div class="m-val">${esc(m.value)}</div><div class="m-label">${esc(m.label)}</div>${m.sub ? `<div class="m-sub">${esc(m.sub)}</div>` : ''}</td>`)
    .join('');
  const filters: [string, string][] = [
    ['Analysis type', ANALYSIS_TYPE_LABELS[results.analysisType]],
    ['Park(s)', results.parkNames.join(', ')],
    ['Location', results.isCombined ? 'All locations (combined analysis)' : results.zoneName ?? 'All locations'],
    ['Date range', formatRange({ from: results.dateFrom, to: results.dateTo })],
    ['Records analysed', String(results.recordCount)],
    ['Analysis mode', results.isCombined ? `Multiple parks – combined (${results.parkIds.length})` : 'Single park'],
  ];
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  @page { margin: 28px; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Roboto, Arial, sans-serif; color: ${C.ink}; font-size: 11.5px; margin: 0; }
  .header { background: ${C.forestDark}; color: #fff; padding: 18px 20px; border-radius: 10px; }
  .brand { font-size: 11px; letter-spacing: 1.2px; text-transform: uppercase; opacity: .8; }
  .header h1 { font-size: 20px; margin: 6px 0 2px; font-weight: 600; }
  .header .sub { font-size: 12px; opacity: .85; }
  h2 { font-size: 14px; margin: 22px 0 8px; color: ${C.forestDark}; border-bottom: 1px solid ${C.line}; padding-bottom: 4px; }
  h3 { font-size: 12px; margin: 16px 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  .filters td { padding: 5px 8px; border-bottom: 1px solid ${C.line}; }
  .filters td:first-child { color: ${C.muted}; width: 34%; }
  .metrics { border-spacing: 8px; border-collapse: separate; margin: 0 -8px; }
  .metric { background: ${C.forestLight}; border-radius: 8px; padding: 10px; vertical-align: top; width: 25%; }
  .m-val { font-size: 18px; font-weight: 600; }
  .m-label { color: ${C.muted}; margin-top: 2px; }
  .m-sub { color: ${C.muted}; font-size: 10px; margin-top: 4px; }
  .barlist td { padding: 3px 4px; vertical-align: middle; }
  .bl-label { width: 34%; }
  .bl-val { width: 12%; text-align: right; font-weight: 600; }
  .track { height: 9px; border-radius: 5px; background: ${C.forestLight}; overflow: hidden; }
  .fill { height: 9px; border-radius: 5px; }
  .columns { table-layout: fixed; }
  .col { vertical-align: bottom; text-align: center; padding: 0 1px; }
  .col-bar { width: 72%; margin: 0 auto; border-radius: 3px 3px 0 0; }
  .col-val { font-size: 8.5px; color: ${C.muted}; }
  .col-label { font-size: 8.5px; color: ${C.muted}; height: 12px; overflow: hidden; white-space: nowrap; }
  .grid th, .grid td { border: 1px solid ${C.line}; padding: 5px 6px; text-align: left; }
  .grid th { background: ${C.forestLight}; font-weight: 600; }
  .num { text-align: right !important; }
  .muted { color: ${C.muted}; }
  .small { font-size: 10px; }
  ul.findings { margin: 0; padding-left: 16px; }
  ul.findings li { margin: 3px 0; }
  .section { page-break-inside: avoid; }
  .footer { margin-top: 26px; border-top: 1px solid ${C.line}; padding-top: 8px; color: ${C.muted}; font-size: 10px; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand">RangerNet · Wildlife Conservation Platform</div>
    <h1>${esc(title)}</h1>
    <div class="sub">Conservation report · ${esc(results.parkNames.join(', '))} · ${esc(formatRange({ from: results.dateFrom, to: results.dateTo }))}</div>
  </div>

  <h2>Analysis filters</h2>
  <table class="filters">${filters.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>

  <h2>Summary statistics</h2>
  <table class="metrics"><tr>${metricCells}</tr></table>

  ${findings.length ? `<div class="section"><h2>Key findings</h2><ul class="findings">${findings.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}

  <h2>Trends, breakdowns and high-risk areas</h2>
  ${typeSections(results)}

  ${comparisonSection(results)}

  <div class="footer">
    Report ref ${esc(reportRef)} · Generated ${esc(formatDateTime(generatedAt))} by ${esc(preparedBy)} (Park Manager / Wildlife Conservation Officer).<br />
    Analysis ${esc(results.analysisId.slice(0, 8).toUpperCase())} run ${esc(formatDateTime(results.analysedAt))}. Data source: RangerNet operations records.
  </div>
</body>
</html>`;
}
