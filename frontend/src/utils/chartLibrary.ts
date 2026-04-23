import { api } from '../api/client';
import type { ChartCatalogItem, ChartPreview, DashboardComponent } from '../types/dashboard';
import { normalizeDisplayText } from './dashboard';
import { normalizeChartDefinition } from './chartDefinition';

export interface ChartRuntimeCard {
  chartCode: string;
  chartName: string;
  component: DashboardComponent;
  preview?: ChartPreview;
}

export function matchCatalogChartKeyword(chart: ChartCatalogItem, keyword: string, normalizeKeyword: (value: string) => string) {
  if (!keyword) return true;
  const normalizedKeyword = normalizeKeyword(keyword);
  return [
    normalizeDisplayText(chart.chartName, chart.chartCode),
    chart.chartCode
  ].some(value => value.toLowerCase().includes(normalizedKeyword));
}

export async function buildChartRuntimeCards(chartCode: string) {
  const runtime = await api.loadRuntimeChart(chartCode);
  const normalized = normalizeChartDefinition(runtime.chart, { primaryOnly: false });
  const previewPairs = await Promise.all(
    normalized.components.map(async component => [
      component.componentCode,
      await api.previewComponent(component)
    ] as const)
  );
  const previewMap = Object.fromEntries(previewPairs);

  return normalized.components.map(component => ({
    chartCode: normalized.chartCode,
    chartName: normalized.chartName,
    component,
    preview: previewMap[component.componentCode]
  })) satisfies ChartRuntimeCard[];
}
