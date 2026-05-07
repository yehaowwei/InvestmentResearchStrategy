import type { ChartRuntimeCard } from '../../utils/chartLibrary';
import { normalizeDisplayText } from '../../utils/dashboard';
import { normalizeSearchKeyword } from '../indicatorPageNavigation';
import type { PersonalChartEntry } from '../../utils/favorites';
import type { DashboardComponent } from '../../types/dashboard';

export type AvailableChartCard = ChartRuntimeCard;

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
    componentType: entry.chart.templateCode === 'table' ? 'table' : 'chart',
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
