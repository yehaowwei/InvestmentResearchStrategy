import type { ChartRuntimeCard } from '../../utils/chartLibrary';
import { normalizeDisplayText } from '../../utils/dashboard';
import { normalizeSearchKeyword } from '../dashboardPageUtils';
import type { PersonalChartEntry } from '../../utils/favorites';
import type { DashboardComponent } from '../../types/dashboard';

export type SortMode = 'manual' | 'time_asc' | 'time_desc';
export type AvailableChartCard = ChartRuntimeCard;

export function parseSortTime(value?: string) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function matchChartKeyword(entry: PersonalChartEntry, keyword: string) {
  if (!keyword) return true;
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  return [
    normalizeDisplayText(entry.chart.componentTitle, entry.chart.componentCode),
    entry.chart.componentCode
  ].some(value => value.toLowerCase().includes(normalizedKeyword));
}

export function toComponent(entry: PersonalChartEntry): DashboardComponent {
  return {
    componentCode: entry.chart.componentCode,
    componentType: 'chart',
    templateCode: entry.chart.templateCode,
    modelCode: entry.chart.modelCode,
    title: entry.chart.componentTitle,
    dslConfig: entry.chart.dslConfig
  };
}

export function matchAvailableChartKeyword(chart: AvailableChartCard, keyword: string) {
  if (!keyword) return true;
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  return [
    normalizeDisplayText(chart.component.dslConfig.visualDsl.title || chart.component.title, chart.component.componentCode),
    normalizeDisplayText(chart.chartName, chart.chartCode),
    chart.component.componentCode,
    chart.chartCode
  ].some(value => value.toLowerCase().includes(normalizedKeyword));
}
