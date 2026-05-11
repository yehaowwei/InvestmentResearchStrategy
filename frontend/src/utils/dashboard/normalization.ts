import type { ComponentDslConfig, DashboardDraft, DatasetModel } from '../../types/dashboard';
import {
  normalizeTableDsl,
  normalizeTableLayoutDsl
} from '../dashboardTable';
import { normalizeDisplayText, resolveModel } from '../dashboardText';
import { normalizeChartLayers } from './chartLayers';
import {
  ensureFilterDefaults,
  ensureMetricDefaults,
  ensureSortDefaults,
  normalizeStatisticItems
} from './statistics';

export function normalizeDslConfig(
  dslConfig: ComponentDslConfig,
  model?: DatasetModel
): ComponentDslConfig {
  const chartLayersDsl = normalizeChartLayers(dslConfig.chartLayersDsl);
  const defaultLayerIds = chartLayersDsl.map(layer => layer.id);
  const dimensionFields = dslConfig.queryDsl.dimensionFields ?? [];
  const metrics = (dslConfig.queryDsl.metrics ?? []).map(metric => ensureMetricDefaults(metric, defaultLayerIds));
  const firstMetric = metrics[0];
  const nextQueryDsl = {
    modelCode: dslConfig.queryDsl.modelCode,
    dimensionFields,
    seriesFields: dslConfig.queryDsl.seriesFields ?? [],
    metrics,
    filters: (dslConfig.queryDsl.filters ?? []).map(ensureFilterDefaults),
    orders: (dslConfig.queryDsl.orders ?? []).map(ensureSortDefaults),
    params: dslConfig.queryDsl.params ?? {},
    limit: dslConfig.queryDsl.limit ?? 500
  };
  const normalized: ComponentDslConfig = {
    queryDsl: nextQueryDsl,
    dimensionConfigDsl: {
      stackBySecondDimension: dslConfig.dimensionConfigDsl?.stackBySecondDimension ?? false,
      layerIds: dslConfig.dimensionConfigDsl?.layerIds?.length ? dslConfig.dimensionConfigDsl.layerIds : defaultLayerIds,
      enableScrollWindow: dslConfig.dimensionConfigDsl?.enableScrollWindow ?? false,
      scrollWindowRange: dslConfig.dimensionConfigDsl?.scrollWindowRange ?? ['', '']
    },
    visualDsl: {
      title: normalizeDisplayText(dslConfig.visualDsl.title),
      subtitle: normalizeDisplayText(dslConfig.visualDsl.subtitle),
      indicatorTag: normalizeDisplayText(dslConfig.visualDsl.indicatorTag),
      xAxisName: normalizeDisplayText(dslConfig.visualDsl.xAxisName),
      leftAxisName: normalizeDisplayText(dslConfig.visualDsl.leftAxisName),
      rightAxisName: normalizeDisplayText(dslConfig.visualDsl.rightAxisName)
    },
    styleDsl: {
      showSymbol: dslConfig.styleDsl.showSymbol ?? false,
      lineWidth: dslConfig.styleDsl.lineWidth ?? 2,
      areaOpacity: dslConfig.styleDsl.areaOpacity ?? 0.2
    },
    interactionDsl: {
      tooltip: dslConfig.interactionDsl.tooltip ?? true,
      legend: dslConfig.interactionDsl.legend ?? true,
      dataZoom: dslConfig.interactionDsl.dataZoom ?? true,
      slider: dslConfig.interactionDsl.slider ?? true
    },
    chartLayersDsl,
    statisticalItemsDsl: normalizeStatisticItems(dslConfig.statisticalItemsDsl, defaultLayerIds, firstMetric?.fieldCode),
    layout: {
      x: dslConfig.layout.x ?? 0,
      y: dslConfig.layout.y ?? 0,
      w: dslConfig.layout.w ?? 12,
      h: dslConfig.layout.h ?? 8
    }
  };
  const tableDsl = normalizeTableDsl({ ...normalized, tableDsl: dslConfig.tableDsl }, model);
  normalized.tableDsl = tableDsl;
  normalized.layoutDsl = normalizeTableLayoutDsl(dslConfig.layoutDsl, tableDsl);
  return normalized;
}

export function normalizeDashboard(draft: DashboardDraft, models: DatasetModel[] = []): DashboardDraft {
  return {
    ...draft,
    name: normalizeDisplayText(draft.name, draft.dashboardCode),
    components: draft.components.map(component => ({
      ...component,
      title: normalizeDisplayText(component.title, component.componentCode),
      dslConfig: normalizeDslConfig(
        component.dslConfig,
        resolveModel(models, component.modelCode)
      )
    }))
  };
}
