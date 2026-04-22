import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts';
import type {
  ChartLayerContext,
  ChartPreview,
  MetricSetting,
  PercentileStatisticConfig,
  StatisticalItemDsl,
  StatisticalLineStyle,
  StatisticLineConfig
} from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';

type CartesianSeriesOption = LineSeriesOption | BarSeriesOption;

export interface ChartTemplateDefinition {
  code: string;
  renderer: 'cartesian_combo' | 'scatter_quadrant' | 'pie' | 'table';
  buildOption?: (
    preview: ChartPreview,
    context?: ChartLayerContext & {
      zoomRange?: {
        start: number;
        end: number;
      };
      compact?: boolean;
      dense?: boolean;
    }
  ) => EChartsOption;
}

const chartTypeMap: Record<string, 'line' | 'bar'> = {
  line: 'line',
  area: 'line',
  bar: 'bar'
};

function resolveActiveLayerId(preview: ChartPreview, context?: ChartLayerContext) {
  const enabledLayers = preview.dslConfig.chartLayersDsl.filter(layer => layer.enabled);
  return enabledLayers.find(layer => layer.id === context?.activeLayerId)?.id ?? enabledLayers[0]?.id;
}

function dimensionFields(preview: ChartPreview, activeLayerId?: string) {
  const allDimensions = preview.queryDsl.dimensionFields?.length
    ? preview.queryDsl.dimensionFields
    : preview.queryDsl.dimensionField
      ? [preview.queryDsl.dimensionField]
      : preview.dimensions;

  if (!activeLayerId) return allDimensions;
  return preview.dslConfig.dimensionConfigDsl.layerIds.includes(activeLayerId) ? allDimensions : [];
}

function visibleMetrics(preview: ChartPreview, activeLayerId?: string) {
  if (!activeLayerId) return preview.dslConfig.queryDsl.metrics;
  return preview.dslConfig.queryDsl.metrics.filter(metric => metric.layerIds.includes(activeLayerId));
}

function splitFields(dimensions: string[]) {
  return dimensions.slice(1);
}

function splitKey(row: Record<string, unknown>, fields: string[]) {
  if (fields.length === 0) return '';
  return fields.map(field => String(row[field] ?? '')).join(' / ');
}

function buildSeriesName(metric: MetricSetting, key: string) {
  const metricName = normalizeDisplayText(metric.displayName, metric.fieldCode);
  return key ? `${metricName} / ${key}` : metricName;
}

function normalizeZoomRange(context?: { zoomRange?: { start: number; end: number } }) {
  const start = context?.zoomRange?.start ?? 0;
  const end = context?.zoomRange?.end ?? 100;
  return {
    start: Math.max(0, Math.min(start, 100)),
    end: Math.max(0, Math.min(end, 100))
  };
}

function formatTimeLabel(value: string | number | undefined | null, axisValues: string[] = []) {
  if (value == null) return '';

  const resolveAxisValue = (raw: string | number) => {
    if (typeof raw === 'number' && Number.isFinite(raw) && axisValues.length > 0) {
      const index = Math.max(0, Math.min(axisValues.length - 1, Math.round(raw)));
      return axisValues[index];
    }
    const textValue = String(raw).trim();
    if (/^\d+(\.\d+)?$/.test(textValue) && axisValues.length > 0) {
      const numericIndex = Number(textValue);
      if (Number.isFinite(numericIndex)) {
        const index = Math.max(0, Math.min(axisValues.length - 1, Math.round(numericIndex)));
        if (Math.abs(index - numericIndex) < 0.0001) {
          return axisValues[index];
        }
      }
    }
    return textValue;
  };

  const text = resolveAxisValue(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) {
    return text.replace(/\//g, '-');
  }
  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }
  if (/^\d{4}-\d{2}$/.test(text)) {
    return text;
  }
  if (/^\d{4}\/\d{2}$/.test(text)) {
    return text.replace('/', '-');
  }
  if (/^\d{6}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(text)) {
    return text.slice(0, 16).replace('T', ' ');
  }
  if (/^\d+$/.test(text)) {
    return text;
  }

  const time = new Date(text).getTime();
  if (Number.isFinite(time)) {
    const date = new Date(time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const hasTime = hours !== '00' || minutes !== '00';
    return hasTime ? `${year}-${month}-${day} ${hours}:${minutes}` : `${year}-${month}-${day}`;
  }

  return text;
}

function resolveVisibleIndexRange(length: number, context?: { zoomRange?: { start: number; end: number } }) {
  if (length <= 1) return { startIndex: 0, endIndex: Math.max(length - 1, 0) };
  const zoom = normalizeZoomRange(context);
  const startIndex = Math.max(0, Math.min(length - 1, Math.floor((zoom.start / 100) * (length - 1))));
  const endIndex = Math.max(startIndex, Math.min(length - 1, Math.ceil((zoom.end / 100) * (length - 1))));
  return { startIndex, endIndex };
}

function parseTime(value: unknown) {
  if (value == null) return Number.NaN;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}

function mean(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: number[], avg: number) {
  if (values.length === 0) return null;
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function percentileRank(values: number[], currentValue: number) {
  if (values.length === 0) return null;
  const lessCount = values.filter(value => value < currentValue).length;
  const equalCount = values.filter(value => value === currentValue).length;
  return ((lessCount + (equalCount * 0.5)) / values.length) * 100;
}

function withOpacity(hex: string, opacity: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const alpha = Math.round(Math.max(0, Math.min(opacity, 1)) * 255).toString(16).padStart(2, '0');
  return `#${normalized}${alpha}`;
}

function resolveStatisticAxisIndex(config: StatisticLineConfig) {
  return config.yAxis === 'right' ? 1 : 0;
}

function buildLineSeries(
  name: string,
  yAxisIndex: number,
  data: Array<number | null>,
  color: string,
  lineStyle: StatisticalLineStyle,
  width: number
): LineSeriesOption {
  return {
    name,
    type: 'line',
    yAxisIndex,
    data,
    symbol: 'none',
    itemStyle: { color },
    lineStyle: { color, type: lineStyle, width }
  };
}

function buildBandSeries(params: {
  id: string;
  namePrefix: string;
  yAxisIndex: number;
  lower: Array<number | null>;
  upper: Array<number | null>;
  lineColor: string;
  bandColor: string;
  lineStyleType: StatisticalLineStyle;
  lineWidth: number;
  opacity: number;
}): LineSeriesOption[] {
  const span = params.upper.map((value, index) => {
    const lower = params.lower[index];
    if (value == null || lower == null) return null;
    return Math.max(0, value - lower);
  });

  return [
    {
      name: `${params.namePrefix} lower-fill`,
      type: 'line',
      yAxisIndex: params.yAxisIndex,
      data: params.lower,
      stack: `${params.id}-band`,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
      areaStyle: { opacity: 0 },
      emphasis: { disabled: true },
      tooltip: { show: false }
    },
    {
      name: `${params.namePrefix} band`,
      type: 'line',
      yAxisIndex: params.yAxisIndex,
      data: span,
      stack: `${params.id}-band`,
      symbol: 'none',
      lineStyle: { opacity: 0 },
      itemStyle: { opacity: 0 },
      areaStyle: { color: withOpacity(params.bandColor, params.opacity) },
      emphasis: { disabled: true },
      tooltip: { show: false }
    },
    buildLineSeries(`${params.namePrefix} upper`, params.yAxisIndex, params.upper, params.lineColor, params.lineStyleType, Math.max(1, params.lineWidth - 0.5)),
    buildLineSeries(`${params.namePrefix} lower`, params.yAxisIndex, params.lower, params.lineColor, params.lineStyleType, Math.max(1, params.lineWidth - 0.5))
  ];
}

function resolveMetricMinTime(preview: ChartPreview, xField: string, metricFieldCode: string) {
  let minTime = Number.POSITIVE_INFINITY;
  for (const row of preview.rows) {
    const time = parseTime(row[xField]);
    const value = Number(row[metricFieldCode] ?? Number.NaN);
    if (!Number.isFinite(time) || !Number.isFinite(value)) continue;
    if (time < minTime) minTime = time;
  }
  return minTime;
}

function sampleRollingWindowValues(preview: ChartPreview, xField: string, metricFieldCode: string, windowStartTime: number, currentTime: number) {
  return preview.rows
    .map(row => ({
      time: parseTime(row[xField]),
      value: Number(row[metricFieldCode] ?? Number.NaN)
    }))
    .filter(row => Number.isFinite(row.time) && Number.isFinite(row.value))
    .filter(row => row.time >= windowStartTime && row.time <= currentTime)
    .map(row => row.value);
}

function buildRollingStatisticData(
  preview: ChartPreview,
  item: StatisticalItemDsl,
  xField: string,
  metricFieldCode: string,
  xValues: string[],
  startIndex: number,
  endIndex: number,
  resolver: (sampleValues: number[], index: number, currentTime: number) => number | null
) {
  const data = Array.from({ length: xValues.length }, () => null as number | null);
  const rollingYears = item.rollingWindowYears && item.rollingWindowYears > 0 ? item.rollingWindowYears : 0;
  if (!rollingYears) return data;

  const metricMinTime = resolveMetricMinTime(preview, xField, metricFieldCode);

  for (let index = startIndex; index <= endIndex; index += 1) {
    const currentTime = parseTime(xValues[index]);
    if (!Number.isFinite(currentTime)) continue;

    const rollingStart = new Date(currentTime);
    rollingStart.setFullYear(rollingStart.getFullYear() - rollingYears);
    const rollingStartTime = rollingStart.getTime();

    if (Number.isFinite(metricMinTime) && rollingStartTime < metricMinTime) continue;

    const sampleValues = sampleRollingWindowValues(preview, xField, metricFieldCode, rollingStartTime, currentTime);
    const value = resolver(sampleValues, index, currentTime);
    if (value != null) {
      data[index] = value;
    }
  }

  return data;
}

function buildRollingPercentileSeries(
  preview: ChartPreview,
  item: StatisticalItemDsl,
  percentileConfig: PercentileStatisticConfig,
  metricFieldCode: string,
  seriesName: string,
  xField: string,
  xValues: string[],
  startIndex: number,
  endIndex: number,
  lineWidth: number
) {
  if (!percentileConfig.enabled) return [] as LineSeriesOption[];
  const data = Array.from({ length: xValues.length }, () => null as number | null);
  const rollingYears = item.rollingWindowYears && item.rollingWindowYears > 0 ? item.rollingWindowYears : 0;
  if (!rollingYears) return [] as LineSeriesOption[];

  const metricMinTime = resolveMetricMinTime(preview, xField, metricFieldCode);

  for (let index = startIndex; index <= endIndex; index += 1) {
    const currentTime = parseTime(xValues[index]);
    if (!Number.isFinite(currentTime)) continue;

    const rollingStart = new Date(currentTime);
    rollingStart.setFullYear(rollingStart.getFullYear() - rollingYears);
    const rollingStartTime = rollingStart.getTime();

    if (Number.isFinite(metricMinTime) && rollingStartTime < metricMinTime) continue;

    const currentRowValues = preview.rows
      .filter(row => String(row[xField] ?? '') === xValues[index])
      .map(row => Number(row[metricFieldCode] ?? Number.NaN))
      .filter(value => Number.isFinite(value));
    const currentValue = mean(currentRowValues);
    if (currentValue == null) continue;

    const sampleValues = sampleRollingWindowValues(preview, xField, metricFieldCode, rollingStartTime, currentTime);
    const value = percentileRank(sampleValues, currentValue);
    if (value != null) {
      data[index] = value;
    }
  }

  if (data.every(value => value == null)) return [] as LineSeriesOption[];

  return [
    buildLineSeries(
      seriesName,
      resolveStatisticAxisIndex(percentileConfig),
      data,
      percentileConfig.lineColor,
      percentileConfig.lineStyle,
      lineWidth
    )
  ];
}

function meanAtX(preview: ChartPreview, xField: string, metricFieldCode: string, xValue: string) {
  const values = preview.rows
    .filter(row => String(row[xField] ?? '') === xValue)
    .map(row => Number(row[metricFieldCode] ?? Number.NaN))
    .filter(value => Number.isFinite(value));
  return mean(values);
}

function sampleVisibleWindowValues(preview: ChartPreview, xField: string, metricFieldCode: string, xValues: string[], startIndex: number, endIndex: number) {
  const visibleSet = new Set(xValues.slice(startIndex, endIndex + 1));
  return preview.rows
    .filter(row => visibleSet.has(String(row[xField] ?? '')))
    .map(row => Number(row[metricFieldCode] ?? Number.NaN))
    .filter(value => Number.isFinite(value));
}

function buildConstantSeriesData(length: number, startIndex: number, endIndex: number, value: number | null) {
  const data = Array.from({ length }, () => null as number | null);
  if (value == null) return data;
  for (let index = startIndex; index <= endIndex; index += 1) {
    data[index] = value;
  }
  return data;
}

function buildStatisticItemSeries(
  preview: ChartPreview,
  xField: string,
  xValues: string[],
  activeLayerId?: string,
  context?: { zoomRange?: { start: number; end: number } }
): LineSeriesOption[] {
  if (!activeLayerId || !xField || xValues.length === 0) return [];

  const statistics = preview.dslConfig.statisticalItemsDsl.filter(item =>
    item.visible.mean.layerIds.includes(activeLayerId)
    || item.visible.std1.layerIds.includes(activeLayerId)
    || item.visible.std2.layerIds.includes(activeLayerId)
    || item.visible.percentile.layerIds.includes(activeLayerId)
    || item.rolling.mean.layerIds.includes(activeLayerId)
    || item.rolling.std1.layerIds.includes(activeLayerId)
    || item.rolling.std2.layerIds.includes(activeLayerId)
    || item.rolling.percentile.layerIds.includes(activeLayerId)
  );
  if (statistics.length === 0) return [];

  const { startIndex, endIndex } = resolveVisibleIndexRange(xValues.length, context);
  const metricsByCode = new Map(preview.dslConfig.queryDsl.metrics.map(metric => [metric.fieldCode, metric]));
  const lineWidth = preview.dslConfig.styleDsl.lineWidth + 0.5;

  return statistics.flatMap(item => {
    const metric = metricsByCode.get(item.metricFieldCode ?? '') ?? preview.dslConfig.queryDsl.metrics[0];
    if (!metric) return [];

    const metricName = normalizeDisplayText(metric.displayName, metric.fieldCode);
    const itemName = normalizeDisplayText(item.itemName, '指标统计量');
    const visibleSamples = sampleVisibleWindowValues(preview, xField, metric.fieldCode, xValues, startIndex, endIndex);
    const visibleAvg = mean(visibleSamples);
    const visibleStd = visibleAvg == null ? null : stdDev(visibleSamples, visibleAvg);
    const rollingYears = item.rollingWindowYears && item.rollingWindowYears > 0 ? item.rollingWindowYears : 0;
    const next: LineSeriesOption[] = [];

    if (item.visible.mean.enabled && item.visible.mean.layerIds.includes(activeLayerId)) {
      next.push(buildLineSeries(
        `${metricName} ${itemName}-均值(视图)` ,
        resolveStatisticAxisIndex(item.visible.mean),
        buildConstantSeriesData(xValues.length, startIndex, endIndex, visibleAvg),
        item.visible.mean.lineColor,
        item.visible.mean.lineStyle,
        lineWidth
      ));
    }

    if (item.visible.std1.enabled && item.visible.std1.layerIds.includes(activeLayerId) && visibleAvg != null && visibleStd != null) {
      next.push(...buildBandSeries({
        id: `${item.id}-visible-std1`,
        namePrefix: `${metricName} ${itemName}-±1σ(视图)`,
        yAxisIndex: resolveStatisticAxisIndex(item.visible.std1),
        lower: buildConstantSeriesData(xValues.length, startIndex, endIndex, visibleAvg - visibleStd),
        upper: buildConstantSeriesData(xValues.length, startIndex, endIndex, visibleAvg + visibleStd),
        lineColor: item.visible.std1.lineColor,
        bandColor: item.visible.std1.bandColor,
        lineStyleType: item.visible.std1.lineStyle,
        lineWidth,
        opacity: 0.18
      }));
    }

    if (item.visible.std2.enabled && item.visible.std2.layerIds.includes(activeLayerId) && visibleAvg != null && visibleStd != null) {
      next.push(...buildBandSeries({
        id: `${item.id}-visible-std2`,
        namePrefix: `${metricName} ${itemName}-±2σ(视图)`,
        yAxisIndex: resolveStatisticAxisIndex(item.visible.std2),
        lower: buildConstantSeriesData(xValues.length, startIndex, endIndex, visibleAvg - (visibleStd * 2)),
        upper: buildConstantSeriesData(xValues.length, startIndex, endIndex, visibleAvg + (visibleStd * 2)),
        lineColor: item.visible.std2.lineColor,
        bandColor: item.visible.std2.bandColor,
        lineStyleType: item.visible.std2.lineStyle,
        lineWidth,
        opacity: 0.1
      }));
    }

    if (item.visible.percentile.enabled && item.visible.percentile.layerIds.includes(activeLayerId) && visibleSamples.length > 0) {
      const data = Array.from({ length: xValues.length }, () => null as number | null);
      for (let index = startIndex; index <= endIndex; index += 1) {
        const currentValue = meanAtX(preview, xField, metric.fieldCode, xValues[index]);
        if (currentValue == null) continue;
        const rank = percentileRank(visibleSamples, currentValue);
        if (rank != null) {
          data[index] = rank;
        }
      }
      if (data.some(value => value != null)) {
        next.push(buildLineSeries(
          `${metricName} ${itemName}-分位点(视图)`,
          resolveStatisticAxisIndex(item.visible.percentile),
          data,
          item.visible.percentile.lineColor,
          item.visible.percentile.lineStyle,
          lineWidth
        ));
      }
    }

    if (rollingYears) {
      if (item.rolling.mean.enabled && item.rolling.mean.layerIds.includes(activeLayerId)) {
        const rollingMean = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => mean(sampleValues));
        if (rollingMean.some(value => value != null)) {
          next.push(buildLineSeries(
            `${metricName} ${itemName}-均值(滚动${rollingYears}年)`,
            resolveStatisticAxisIndex(item.rolling.mean),
            rollingMean,
            item.rolling.mean.lineColor,
            item.rolling.mean.lineStyle,
            lineWidth
          ));
        }
      }

      if (item.rolling.std1.enabled && item.rolling.std1.layerIds.includes(activeLayerId)) {
        const upper = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => {
          const avg = mean(sampleValues);
          if (avg == null) return null;
          const deviation = stdDev(sampleValues, avg) ?? 0;
          return avg + deviation;
        });
        const lower = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => {
          const avg = mean(sampleValues);
          if (avg == null) return null;
          const deviation = stdDev(sampleValues, avg) ?? 0;
          return avg - deviation;
        });
        if ([...upper, ...lower].some(value => value != null)) {
          next.push(...buildBandSeries({
            id: `${item.id}-rolling-std1`,
            namePrefix: `${metricName} ${itemName}-±1σ(滚动${rollingYears}年)`,
            yAxisIndex: resolveStatisticAxisIndex(item.rolling.std1),
            lower,
            upper,
            lineColor: item.rolling.std1.lineColor,
            bandColor: item.rolling.std1.bandColor,
            lineStyleType: item.rolling.std1.lineStyle,
            lineWidth,
            opacity: 0.18
          }));
        }
      }

      if (item.rolling.std2.enabled && item.rolling.std2.layerIds.includes(activeLayerId)) {
        const upper = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => {
          const avg = mean(sampleValues);
          if (avg == null) return null;
          const deviation = stdDev(sampleValues, avg) ?? 0;
          return avg + (deviation * 2);
        });
        const lower = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => {
          const avg = mean(sampleValues);
          if (avg == null) return null;
          const deviation = stdDev(sampleValues, avg) ?? 0;
          return avg - (deviation * 2);
        });
        if ([...upper, ...lower].some(value => value != null)) {
          next.push(...buildBandSeries({
            id: `${item.id}-rolling-std2`,
            namePrefix: `${metricName} ${itemName}-±2σ(滚动${rollingYears}年)`,
            yAxisIndex: resolveStatisticAxisIndex(item.rolling.std2),
            lower,
            upper,
            lineColor: item.rolling.std2.lineColor,
            bandColor: item.rolling.std2.bandColor,
            lineStyleType: item.rolling.std2.lineStyle,
            lineWidth,
            opacity: 0.1
          }));
        }
      }

      if (item.rolling.percentile.enabled && item.rolling.percentile.layerIds.includes(activeLayerId)) {
        next.push(...buildRollingPercentileSeries(
          preview,
          item,
          item.rolling.percentile,
          metric.fieldCode,
          `${metricName} ${itemName}-分位点(滚动${rollingYears}年)`,
          xField,
          xValues,
          startIndex,
          endIndex,
          lineWidth
        ));
      }
    }

    return next;
  });
}

function hasStatisticOnRightAxis(preview: ChartPreview, activeLayerId?: string) {
  if (!activeLayerId) return false;

  return preview.dslConfig.statisticalItemsDsl.some(item =>
    (item.visible.mean.enabled && item.visible.mean.yAxis === 'right' && item.visible.mean.layerIds.includes(activeLayerId))
    || (item.visible.std1.enabled && item.visible.std1.yAxis === 'right' && item.visible.std1.layerIds.includes(activeLayerId))
    || (item.visible.std2.enabled && item.visible.std2.yAxis === 'right' && item.visible.std2.layerIds.includes(activeLayerId))
    || (item.visible.percentile.enabled && item.visible.percentile.yAxis === 'right' && item.visible.percentile.layerIds.includes(activeLayerId))
    || (item.rolling.mean.enabled && item.rolling.mean.yAxis === 'right' && item.rolling.mean.layerIds.includes(activeLayerId))
    || (item.rolling.std1.enabled && item.rolling.std1.yAxis === 'right' && item.rolling.std1.layerIds.includes(activeLayerId))
    || (item.rolling.std2.enabled && item.rolling.std2.yAxis === 'right' && item.rolling.std2.layerIds.includes(activeLayerId))
    || (item.rolling.percentile.enabled && item.rolling.percentile.yAxis === 'right' && item.rolling.percentile.layerIds.includes(activeLayerId))
  );
}

function buildCartesianComboOption(
  preview: ChartPreview,
  context?: ChartLayerContext & { zoomRange?: { start: number; end: number }; compact?: boolean; dense?: boolean }
): EChartsOption {
  const activeLayerId = resolveActiveLayerId(preview, context);
  const dimensions = dimensionFields(preview, activeLayerId);
  const metrics = visibleMetrics(preview, activeLayerId);
  const { visualDsl, styleDsl, interactionDsl } = preview.dslConfig;
  const xField = dimensions[0];
  const splitBy = splitFields(dimensions);
  const xValues = xField ? Array.from(new Set(preview.rows.map(row => String(row[xField] ?? '')))) : [];
  const splitValues = splitBy.length > 0 ? Array.from(new Set(preview.rows.map(row => splitKey(row, splitBy)))) : [''];
  const hasRightAxis = metrics.some(metric => metric.yAxis === 'right') || hasStatisticOnRightAxis(preview, activeLayerId);
  const zoom = normalizeZoomRange(context);
  const enableStack = preview.dslConfig.dimensionConfigDsl.stackBySecondDimension && dimensions.length >= 2;
  const compact = Boolean(context?.compact);
  const dense = !compact && Boolean(context?.dense);
  const sliderBottom = 0;
  const gridBottom = interactionDsl.slider
    ? (compact ? 40 : dense ? 34 : 46)
    : (compact ? 38 : dense ? 28 : 40);

  return {
    animationDuration: compact ? 0 : 300,
    color: metrics.map(metric => metric.color),
    tooltip: compact || !interactionDsl.tooltip ? { show: false } : {
      trigger: 'axis',
      confine: dense,
      padding: dense ? [4, 6] : [8, 10],
      borderWidth: dense ? 1 : undefined,
      textStyle: dense ? { fontSize: 10, color: '#0f172a' } : { color: '#0f172a' },
      axisPointer: {
        type: 'line',
        label: {
          show: !dense
        }
      },
      extraCssText: dense
        ? 'max-width: 180px; white-space: normal; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);'
        : undefined
    },
    legend: compact || !interactionDsl.legend ? { show: false } : {
      top: dense ? 2 : 0,
      type: 'scroll',
      itemWidth: dense ? 10 : 14,
      itemHeight: dense ? 7 : 10,
      textStyle: dense ? { fontSize: 10, color: '#1f2937' } : { color: '#1f2937' }
    },
    grid: compact
      ? { left: 40, right: hasRightAxis ? 40 : 18, top: 16, bottom: gridBottom, containLabel: true }
      : dense
        ? { left: 52, right: hasRightAxis ? 52 : 22, top: 34, bottom: gridBottom, containLabel: true }
        : { left: 64, right: hasRightAxis ? 64 : 28, top: 52, bottom: gridBottom, containLabel: true },
    dataZoom: compact
      ? interactionDsl.dataZoom
        ? [
          ...(interactionDsl.slider
            ? [{
              type: 'slider' as const,
              start: zoom.start,
              end: zoom.end,
              height: 16,
              bottom: sliderBottom,
              showDetail: false,
              brushSelect: false,
              textStyle: { color: '#475569', fontSize: 10 },
              labelFormatter: (value: string | number) => formatTimeLabel(value, xValues)
            }]
            : []),
          { type: 'inside' as const, start: zoom.start, end: zoom.end }
        ]
        : []
      : interactionDsl.dataZoom
        ? [
        ...(interactionDsl.slider ? [{
          type: 'slider' as const,
          start: zoom.start,
          end: zoom.end,
          height: dense ? 14 : 18,
          bottom: sliderBottom,
          showDetail: false,
          brushSelect: false,
          textStyle: { color: '#475569', fontSize: dense ? 9 : 11 },
          labelFormatter: (value: string | number) => formatTimeLabel(value, xValues)
        }] : []),
        { type: 'inside' as const, start: zoom.start, end: zoom.end }
      ]
        : [],
    xAxis: {
      type: 'category',
      name: compact ? '' : visualDsl.xAxisName,
      boundaryGap: metrics.some(metric => metric.chartType === 'bar'),
      data: xValues,
      axisLabel: compact
        ? {
          fontSize: 10,
          margin: 6,
          hideOverlap: true,
          rotate: xValues.length > 8 ? 20 : 0,
          formatter: (value: string) => formatTimeLabel(value, xValues)
        }
        : {
          fontSize: dense ? 10 : undefined,
          color: '#475569',
          margin: dense ? 6 : 8,
          hideOverlap: true,
          rotate: xValues.length > 12 ? (dense ? 20 : 24) : 0,
          formatter: (value: string) => formatTimeLabel(value, xValues)
        },
      axisTick: compact ? { show: true, alignWithLabel: true } : { show: true, alignWithLabel: true },
      axisLine: compact ? { show: true } : { show: true }
    },
    yAxis: [
      {
        type: 'value',
        name: compact ? '' : visualDsl.leftAxisName,
        axisLabel: compact ? { fontSize: 10, margin: 8, color: '#475569' } : { fontSize: dense ? 10 : undefined, color: '#475569', margin: dense ? 8 : 10, hideOverlap: true },
        axisTick: compact ? { show: true } : { show: true },
        axisLine: compact ? { show: true } : { show: true },
        splitNumber: compact ? 4 : undefined
      },
      {
        type: 'value',
        name: compact ? '' : visualDsl.rightAxisName,
        show: hasRightAxis,
        axisLabel: compact ? { fontSize: 10, margin: 8, color: '#475569' } : { fontSize: dense ? 10 : undefined, color: '#475569', margin: dense ? 8 : 10, hideOverlap: true },
        axisTick: compact ? { show: true } : { show: true },
        axisLine: compact ? { show: true } : { show: true },
        splitNumber: compact ? 4 : undefined
      }
    ],
    series: [
      ...(metrics.flatMap(metric => splitValues.map(key => {
        const rowsByX = new Map(
          preview.rows
            .filter(row => splitKey(row, splitBy) === key)
            .map(row => [String(row[xField] ?? ''), row])
        );
        const type = chartTypeMap[metric.chartType] ?? 'line';
        const baseStackKey = enableStack ? `${metric.fieldCode}-${metric.yAxis}` : undefined;
        const itemColor = type === 'bar'
          ? ((params: { value?: number }) => (Number(params?.value ?? 0) < 0 ? (metric.negativeColor || '#dc2626') : metric.color))
          : metric.color;

        const series: CartesianSeriesOption = {
          name: buildSeriesName(metric, key),
          type,
          yAxisIndex: metric.yAxis === 'right' ? 1 : 0,
          data: xValues.map(x => Number(rowsByX.get(x)?.[metric.fieldCode] ?? 0)),
          stack: baseStackKey,
          itemStyle: { color: itemColor as never },
          lineStyle: { width: styleDsl.lineWidth, color: metric.color },
          smooth: type === 'line' ? metric.smooth : false,
          showSymbol: type === 'line' ? styleDsl.showSymbol : undefined
        };

        if (metric.chartType === 'area') {
          return { ...series, areaStyle: { opacity: styleDsl.areaOpacity, color: metric.color } } as LineSeriesOption;
        }

        return series;
      })) as CartesianSeriesOption[]),
      ...buildStatisticItemSeries(preview, xField, xValues, activeLayerId, context)
    ]
  };
}

const templates: Record<string, ChartTemplateDefinition> = {
  line: {
    code: 'line',
    renderer: 'cartesian_combo',
    buildOption: buildCartesianComboOption
  },
  mixed: {
    code: 'mixed',
    renderer: 'cartesian_combo',
    buildOption: buildCartesianComboOption
  },
  bar: {
    code: 'bar',
    renderer: 'cartesian_combo',
    buildOption: buildCartesianComboOption
  },
  cartesian_combo: {
    code: 'cartesian_combo',
    renderer: 'cartesian_combo',
    buildOption: buildCartesianComboOption
  },
  scatter: {
    code: 'scatter',
    renderer: 'scatter_quadrant'
  },
  table: {
    code: 'table',
    renderer: 'table'
  }
};

export function getChartTemplate(code?: string) {
  return templates[code ?? 'line'] ?? templates.line;
}
