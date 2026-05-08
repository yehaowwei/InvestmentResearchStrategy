import type {
  FilterCondition,
  MetricSetting,
  SortCondition,
  StatisticLineConfig,
  StatisticalItemDsl
} from '../../types/dashboard';
import { normalizeDisplayText } from '../dashboardText';

export function normalizeStatisticItemName(name: string | undefined, index: number) {
  const repairedName = normalizeDisplayText(name);
  return repairedName || '';
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

function defaultScrollWindowRange(): [string, string] {
  return ['', ''];
}

export function createStatisticItem(defaultLayerIds: string[], metricFieldCode?: string, index = 0): StatisticalItemDsl {
  return {
    id: `stat-item-${Date.now()}-${index}`,
    itemName: '',
    metricFieldCode: metricFieldCode || '',
    rollingWindowYears: 3,
    visible: {
      mean: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#dc2626',
        lineStyle: 'solid',
        layerIds: defaultLayerIds,
        enableScrollWindow: true,
        scrollWindowRange: defaultScrollWindowRange()
      },
      std1: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#f97316',
        bandColor: '#fdba74',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds,
        enableScrollWindow: true,
        scrollWindowRange: defaultScrollWindowRange()
      },
      std2: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#fb7185',
        bandColor: '#fecdd3',
        lineStyle: 'dotted',
        layerIds: defaultLayerIds,
        enableScrollWindow: true,
        scrollWindowRange: defaultScrollWindowRange()
      },
      percentile: {
        ...createPercentileConfig(),
        layerIds: defaultLayerIds,
        enableScrollWindow: true,
        scrollWindowRange: defaultScrollWindowRange()
      }
    },
    rolling: {
      mean: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#FF9F7F',
        lineStyle: 'solid',
        layerIds: defaultLayerIds,
        enableScrollWindow: true,
        scrollWindowRange: defaultScrollWindowRange()
      },
      std1: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#3BA272',
        bandColor: '#a7f3d0',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds,
        enableScrollWindow: true,
        scrollWindowRange: defaultScrollWindowRange()
      },
      std2: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#73C0DE',
        bandColor: '#bae6fd',
        lineStyle: 'dotted',
        layerIds: defaultLayerIds,
        enableScrollWindow: true,
        scrollWindowRange: defaultScrollWindowRange()
      },
      percentile: {
        enabled: false,
        yAxis: 'right',
        lineColor: '#9A60B4',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds,
        enableScrollWindow: true,
        scrollWindowRange: defaultScrollWindowRange()
      }
    }
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
    showSymbol: metric.showSymbol ?? false,
    layerIds: metric.layerIds?.length ? metric.layerIds : defaultLayerIds,
    enableScrollWindow: metric.enableScrollWindow ?? true,
    scrollWindowRange: defaultScrollWindowRange()
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

export function normalizeStatisticItems(
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
        layerIds: value?.layerIds?.length ? value.layerIds : defaultLayerIds,
        enableScrollWindow: value?.enableScrollWindow ?? defaults.enableScrollWindow ?? false,
        scrollWindowRange: value?.scrollWindowRange ?? defaults.scrollWindowRange ?? defaultScrollWindowRange()
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
        scrollWindowRange: item.scrollWindowRange ?? defaultScrollWindowRange(),
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

  return [];
}
