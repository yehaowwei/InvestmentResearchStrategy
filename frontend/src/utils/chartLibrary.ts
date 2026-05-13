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

const FORCE_SCROLL_WINDOW_CHARTS = new Set(['chart_6', 'chart_8', 'chart_10']);

export function createLocalComponentPreview(component: DashboardComponent): ChartPreview {
  return {
    modelCode: component.modelCode,
    queryDsl: component.dslConfig.queryDsl,
    rows: [],
    dslConfig: component.dslConfig
  };
}

export async function loadComponentPreview(component: DashboardComponent) {
  if (component.templateCode === 'table' || component.componentType === 'table') {
    return createLocalComponentPreview(component);
  }
  return api.previewComponent(component);
}

function withRuntimeDefaults<T extends { chartCode: string; component: DashboardComponent; preview?: ChartPreview }>(card: T): T {
  if (!FORCE_SCROLL_WINDOW_CHARTS.has(card.chartCode)) {
    return card;
  }

  const component = {
    ...card.component,
    dslConfig: {
      ...card.component.dslConfig,
      dimensionConfigDsl: {
        ...card.component.dslConfig.dimensionConfigDsl,
        enableScrollWindow: true
      }
    }
  };
  const preview = card.preview
    ? {
      ...card.preview,
      dslConfig: {
        ...card.preview.dslConfig,
        dimensionConfigDsl: {
          ...card.preview.dslConfig.dimensionConfigDsl,
          enableScrollWindow: true
        }
      }
    }
    : card.preview;

  return {
    ...card,
    component,
    preview
  };
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
  const components = normalized.components.map(component => withRuntimeDefaults({
    chartCode: normalized.chartCode,
    chartName: normalized.chartName,
    component
  }).component);
  const previewPairs = await Promise.all(
    components.map(async component => [
      component.componentCode,
      await loadComponentPreview(component)
    ] as const)
  );
  const previewMap = Object.fromEntries(previewPairs);

  return components.map(component => withRuntimeDefaults({
    chartCode: normalized.chartCode,
    chartName: normalized.chartName,
    component,
    preview: previewMap[component.componentCode]
  })) satisfies ChartRuntimeCard[];
}
