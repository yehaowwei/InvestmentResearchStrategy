import type {
  ChartLayerDsl,
  ComponentDslConfig,
  DashboardComponent,
  DashboardDraft,
  DatasetModel,
  FilterCondition,
  MetricSetting,
  SortCondition,
  StatisticLineConfig,
  StatisticalItemDsl,
  TemplateDefinition
} from '../types/dashboard';
import {
  buildInitialTableDsl,
  buildTableColumnsFromQuery,
  normalizeTableDsl,
  normalizeTableLayoutDsl,
  syncTableComponentWithModel as syncTableComponentWithModelBase
} from './dashboardTable';
import {
  deepClone,
  getDefaultTableColumnFields,
  isSelectableTableField,
  normalizeDisplayText,
  resolveModel
} from './dashboardText';

export {
  buildInitialTableDsl,
  buildTableColumnsFromQuery,
  deepClone,
  getDefaultTableColumnFields,
  isSelectableTableField,
  normalizeDisplayText,
  normalizeTableDsl,
  normalizeTableLayoutDsl,
  resolveModel
};

export function createChartLayer(index = 0): ChartLayerDsl {
  return {
    id: `chart-layer-${Date.now()}-${index}`,
    layerName: `图层 ${index + 1}`,
    enabled: true
  };
}

export function normalizeStatisticItemName(name: string | undefined, index: number) {
  const repairedName = normalizeDisplayText(name);
  if (!repairedName || /^(统计图层|指标统计量)\s*\d*$/.test(repairedName)) {
    return `统计量${index + 1}`;
  }
  return repairedName;
}

function createPercentileConfig() {
  return {
    enabled: false,
    yAxis: 'right' as const,
    lineColor: '#7c3aed',
    lineStyle: 'dashed' as const,
    layerIds: [] as string[]
  };
}

export function createStatisticItem(defaultLayerIds: string[], metricFieldCode?: string, index = 0): StatisticalItemDsl {
  return {
    id: `stat-item-${Date.now()}-${index}`,
    itemName: `统计量${index + 1}`,
    metricFieldCode: metricFieldCode || '',
    rollingWindowYears: 3,
    visible: {
      mean: {
        enabled: true,
        yAxis: 'left',
        lineColor: '#dc2626',
        lineStyle: 'solid',
        layerIds: defaultLayerIds
      },
      std1: {
        enabled: true,
        yAxis: 'left',
        lineColor: '#f97316',
        bandColor: '#fdba74',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds
      },
      std2: {
        enabled: true,
        yAxis: 'left',
        lineColor: '#fb7185',
        bandColor: '#fecdd3',
        lineStyle: 'dotted',
        layerIds: defaultLayerIds
      },
      percentile: {
        ...createPercentileConfig(),
        layerIds: defaultLayerIds
      }
    },
    rolling: {
      mean: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#FF9F7F',
        lineStyle: 'solid',
        layerIds: defaultLayerIds
      },
      std1: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#3BA272',
        bandColor: '#a7f3d0',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds
      },
      std2: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#73C0DE',
        bandColor: '#bae6fd',
        lineStyle: 'dotted',
        layerIds: defaultLayerIds
      },
      percentile: {
        enabled: false,
        yAxis: 'right',
        lineColor: '#9A60B4',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds
      }
    }
  };
}

export function createComponentFromTemplate(template: TemplateDefinition, modelCode: string, index: number): DashboardComponent {
  const dslConfig = normalizeDslConfig(deepClone(template.defaultDsl));
  const firstLayerId = dslConfig.chartLayersDsl[0]?.id || createChartLayer(0).id;
  const isTable = template.templateCode === 'table' || template.rendererCode === 'table' || template.capability?.renderer === 'table';
  dslConfig.queryDsl = {
    ...dslConfig.queryDsl,
    modelCode,
    dimensionFields: [],
    seriesFields: [],
    metrics: [],
    filters: [],
    orders: [],
    params: {}
  };
  dslConfig.dimensionConfigDsl = {
    ...dslConfig.dimensionConfigDsl,
    layerIds: [firstLayerId]
  };
  dslConfig.statisticalItemsDsl = [createStatisticItem([firstLayerId], '', index)];
  dslConfig.layout = {
    ...dslConfig.layout,
    y: index * 9
  };
  if (isTable) {
    dslConfig.layout = {
      ...dslConfig.layout,
      h: 10
    };
    dslConfig.layoutDsl = normalizeTableLayoutDsl();
    dslConfig.tableDsl = normalizeTableDsl(dslConfig);
  }

  return {
    componentCode: `cmp-${Date.now()}-${index}`,
    componentType: isTable ? 'table' : 'chart',
    templateCode: template.templateCode,
    modelCode,
    title: normalizeDisplayText(template.templateName, template.templateCode),
    dslConfig
  };
}

export function ensureMetricDefaults(metric: MetricSetting, defaultLayerIds: string[]): MetricSetting {
  return {
    fieldCode: metric.fieldCode,
    displayName: normalizeDisplayText(metric.displayName, metric.fieldCode),
    aggType: metric.aggType || 'sum',
    chartType: metric.chartType || 'line',
    yAxis: metric.yAxis || 'left',
    color: metric.color || '#1d4ed8',
    negativeColor: metric.negativeColor || '#dc2626',
    smooth: metric.smooth ?? false,
    layerIds: metric.layerIds?.length ? metric.layerIds : defaultLayerIds
  };
}

export function ensureFilterDefaults(filter: FilterCondition): FilterCondition {
  return {
    fieldCode: filter.fieldCode,
    operator: filter.operator || 'eq',
    value: filter.value || '',
    values: filter.values ?? []
  };
}

export function ensureSortDefaults(sort: SortCondition): SortCondition {
  return {
    fieldCode: sort.fieldCode,
    direction: sort.direction || 'asc'
  };
}

function normalizeChartLayers(chartLayers: ChartLayerDsl[] | undefined) {
  if (chartLayers?.length) {
    return chartLayers.map((layer, index) => ({
      id: layer.id || `chart-layer-${index}`,
      layerName: normalizeDisplayText(layer.layerName, `图层 ${index + 1}`),
      enabled: layer.enabled ?? true
    }));
  }
  return [createChartLayer(0)];
}

function normalizeStatisticItems(
  items: StatisticalItemDsl[] | undefined,
  defaultLayerIds: string[],
  firstMetricCode?: string
) {
  if (items?.length) {
    return items.map((item, index) => {
      const metricFieldCode = item.metricFieldCode || firstMetricCode || '';
      const wrapLine = (value: StatisticLineConfig, defaults: StatisticLineConfig): StatisticLineConfig => ({
        enabled: value?.enabled ?? defaults.enabled,
        yAxis: value?.yAxis === 'right' ? 'right' : defaults.yAxis,
        lineColor: value?.lineColor || defaults.lineColor,
        lineStyle: value?.lineStyle ?? defaults.lineStyle,
        layerIds: value?.layerIds?.length ? value.layerIds : defaultLayerIds
      });
      const wrapBand = (value: StatisticalItemDsl['visible']['std1'], defaults: StatisticalItemDsl['visible']['std1']) => ({
        ...wrapLine(value, defaults),
        bandColor: value?.bandColor || defaults.bandColor
      });
      const defaultItem = createStatisticItem(defaultLayerIds, metricFieldCode, index);
      return {
        id: item.id || `stat-item-${index}`,
        itemName: normalizeStatisticItemName(item.itemName, index),
        metricFieldCode,
        rollingWindowYears: item.rollingWindowYears && item.rollingWindowYears > 0 ? item.rollingWindowYears : 3,
        visible: {
          mean: wrapLine(item.visible.mean, defaultItem.visible.mean),
          std1: wrapBand(item.visible.std1, defaultItem.visible.std1),
          std2: wrapBand(item.visible.std2, defaultItem.visible.std2),
          percentile: wrapLine(item.visible.percentile, defaultItem.visible.percentile)
        },
        rolling: {
          mean: wrapLine(item.rolling.mean, defaultItem.rolling.mean),
          std1: wrapBand(item.rolling.std1, defaultItem.rolling.std1),
          std2: wrapBand(item.rolling.std2, defaultItem.rolling.std2),
          percentile: wrapLine(item.rolling.percentile, defaultItem.rolling.percentile)
        }
      };
    });
  }

  return [createStatisticItem(defaultLayerIds, firstMetricCode, 0)];
}

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
      layerIds: dslConfig.dimensionConfigDsl?.layerIds?.length ? dslConfig.dimensionConfigDsl.layerIds : defaultLayerIds
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

export function normalizeComponentForTransport(
  component: DashboardComponent,
  model?: DatasetModel
): DashboardComponent {
  const normalizedDsl = normalizeDslConfig(component.dslConfig, model);
  const normalizedModelCode = normalizedDsl.queryDsl.modelCode || component.modelCode;
  return {
    ...component,
    modelCode: normalizedModelCode,
    title: normalizeDisplayText(component.title, component.componentCode),
    dslConfig: {
      ...normalizedDsl,
      queryDsl: {
        ...normalizedDsl.queryDsl,
        modelCode: normalizedModelCode
      },
      visualDsl: {
        ...normalizedDsl.visualDsl,
        title: normalizeDisplayText(normalizedDsl.visualDsl.title, component.title || component.componentCode)
      }
    }
  };
}

export function normalizeDashboardForTransport(
  draft: DashboardDraft,
  models: DatasetModel[] = []
): DashboardDraft {
  return {
    ...draft,
    name: normalizeDisplayText(draft.name, draft.dashboardCode),
    components: draft.components.map(component =>
      normalizeComponentForTransport(component, resolveModel(models, component.modelCode))
    )
  };
}

export function syncTableComponentWithModel(
  component: DashboardComponent,
  model?: DatasetModel,
  previewRows: Record<string, unknown>[] = []
) {
  return syncTableComponentWithModelBase(component, normalizeDslConfig, model, previewRows);
}
