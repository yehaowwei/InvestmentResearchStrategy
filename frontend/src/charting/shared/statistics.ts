import type { LineSeriesOption } from 'echarts';
import type {
  ChartPreview,
  MetricSetting,
  PercentileStatisticConfig,
  StatisticalItemDsl,
  StatisticalLineStyle,
  StatisticLineConfig
} from '../../types/dashboard';
import { normalizeDisplayText } from '../../utils/dashboard';
import { parseTime, resolveVisibleIndexRange } from './time';

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

function buildLineSeries(name: string, yAxisIndex: number, data: Array<number | null>, color: string, lineStyle: StatisticalLineStyle, width: number): LineSeriesOption {
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
    if (value != null) data[index] = value;
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
    if (value != null) data[index] = value;
  }

  if (data.every(value => value == null)) return [] as LineSeriesOption[];
  return [buildLineSeries(seriesName, resolveStatisticAxisIndex(percentileConfig), data, percentileConfig.lineColor, percentileConfig.lineStyle, lineWidth)];
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

function isStatisticVisibleOnLayer(item: StatisticalItemDsl, activeLayerId: string) {
  return item.visible.mean.layerIds.includes(activeLayerId)
    || item.visible.std1.layerIds.includes(activeLayerId)
    || item.visible.std2.layerIds.includes(activeLayerId)
    || item.visible.percentile.layerIds.includes(activeLayerId)
    || item.rolling.mean.layerIds.includes(activeLayerId)
    || item.rolling.std1.layerIds.includes(activeLayerId)
    || item.rolling.std2.layerIds.includes(activeLayerId)
    || item.rolling.percentile.layerIds.includes(activeLayerId);
}

export function buildStatisticItemSeries(
  preview: ChartPreview,
  xField: string,
  xValues: string[],
  activeLayerId?: string,
  context?: { zoomRange?: { start: number; end: number } }
): LineSeriesOption[] {
  if (!activeLayerId || !xField || xValues.length === 0) return [];

  const statistics = preview.dslConfig.statisticalItemsDsl.filter(item => isStatisticVisibleOnLayer(item, activeLayerId));
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
      next.push(buildLineSeries(`${metricName} ${itemName}-均值(视图)`, resolveStatisticAxisIndex(item.visible.mean), buildConstantSeriesData(xValues.length, startIndex, endIndex, visibleAvg), item.visible.mean.lineColor, item.visible.mean.lineStyle, lineWidth));
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
        if (rank != null) data[index] = rank;
      }
      if (data.some(value => value != null)) {
        next.push(buildLineSeries(`${metricName} ${itemName}-分位点(视图)`, resolveStatisticAxisIndex(item.visible.percentile), data, item.visible.percentile.lineColor, item.visible.percentile.lineStyle, lineWidth));
      }
    }

    if (rollingYears) {
      if (item.rolling.mean.enabled && item.rolling.mean.layerIds.includes(activeLayerId)) {
        const rollingMean = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => mean(sampleValues));
        if (rollingMean.some(value => value != null)) {
          next.push(buildLineSeries(`${metricName} ${itemName}-均值(滚动${rollingYears}年)`, resolveStatisticAxisIndex(item.rolling.mean), rollingMean, item.rolling.mean.lineColor, item.rolling.mean.lineStyle, lineWidth));
        }
      }

      if (item.rolling.std1.enabled && item.rolling.std1.layerIds.includes(activeLayerId)) {
        const upper = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => {
          const avg = mean(sampleValues);
          if (avg == null) return null;
          return avg + (stdDev(sampleValues, avg) ?? 0);
        });
        const lower = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => {
          const avg = mean(sampleValues);
          if (avg == null) return null;
          return avg - (stdDev(sampleValues, avg) ?? 0);
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
          return avg + ((stdDev(sampleValues, avg) ?? 0) * 2);
        });
        const lower = buildRollingStatisticData(preview, item, xField, metric.fieldCode, xValues, startIndex, endIndex, sampleValues => {
          const avg = mean(sampleValues);
          if (avg == null) return null;
          return avg - ((stdDev(sampleValues, avg) ?? 0) * 2);
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
        next.push(...buildRollingPercentileSeries(preview, item, item.rolling.percentile, metric.fieldCode, `${metricName} ${itemName}-分位点(滚动${rollingYears}年)`, xField, xValues, startIndex, endIndex, lineWidth));
      }
    }

    return next;
  });
}

export function hasStatisticOnRightAxis(preview: ChartPreview, activeLayerId?: string) {
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

export function buildSeriesName(metric: MetricSetting, key: string) {
  const metricName = normalizeDisplayText(metric.displayName, metric.fieldCode);
  return key ? `${metricName} / ${key}` : metricName;
}
