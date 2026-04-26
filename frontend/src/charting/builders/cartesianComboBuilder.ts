import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts';
import type { ChartPreview } from '../../types/dashboard';
import type { ChartRenderContext } from '../types';
import { buildSeriesName, buildStatisticItemSeries, hasStatisticOnRightAxis } from '../shared/statistics';
import { formatTimeLabel, normalizeZoomRange } from '../shared/time';

type CartesianSeriesOption = LineSeriesOption | BarSeriesOption;

const chartTypeMap: Record<string, 'line' | 'bar'> = {
  line: 'line',
  area: 'line',
  bar: 'bar'
};

function resolveActiveLayerId(preview: ChartPreview, context?: ChartRenderContext) {
  const enabledLayers = preview.dslConfig.chartLayersDsl.filter(layer => layer.enabled);
  return enabledLayers.find(layer => layer.id === context?.activeLayerId)?.id ?? enabledLayers[0]?.id;
}

function dimensionFields(preview: ChartPreview, activeLayerId?: string) {
  const allDimensions = preview.queryDsl.dimensionFields ?? [];
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

export function buildCartesianComboOption(preview: ChartPreview, context?: ChartRenderContext): EChartsOption {
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
  const thumbnail = Boolean(context?.thumbnail);
  const legendRightPadding = dense ? 112 : 140;
  const sliderBottom = 0;
  const gridBottom = interactionDsl.slider ? (compact ? 40 : dense ? 34 : 46) : (compact ? 38 : dense ? 28 : 40);
  const thumbnailGrid = {
    left: 40,
    right: hasRightAxis ? 44 : 20,
    top: 16,
    bottom: 34,
    containLabel: true
  };

  return {
    animationDuration: compact ? 0 : 300,
    color: metrics.map(metric => metric.color),
    tooltip: compact || !interactionDsl.tooltip ? { show: false } : {
      trigger: 'axis',
      confine: dense,
      padding: dense ? [4, 6] : [8, 10],
      borderWidth: dense ? 1 : undefined,
      textStyle: dense ? { fontSize: 10, color: '#0f172a' } : { color: '#0f172a' },
      axisPointer: { type: 'line', label: { show: !dense } },
      extraCssText: dense ? 'max-width: 180px; white-space: normal; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);' : undefined
    },
    legend: compact || thumbnail || !interactionDsl.legend ? { show: false } : {
      top: dense ? 2 : 0,
      left: dense ? 8 : 12,
      right: legendRightPadding,
      type: 'scroll',
      itemWidth: dense ? 10 : 14,
      itemHeight: dense ? 7 : 10,
      pageIconColor: '#475569',
      pageIconInactiveColor: '#94a3b8',
      pageIconSize: dense ? 10 : 12,
      pageTextStyle: dense ? { fontSize: 10, color: '#1f2937' } : { color: '#1f2937' },
      textStyle: dense ? { fontSize: 10, color: '#1f2937' } : { color: '#1f2937' }
    },
    grid: thumbnail
      ? thumbnailGrid
      : compact
      ? { left: 40, right: hasRightAxis ? 40 : 18, top: 16, bottom: gridBottom, containLabel: true }
      : dense
        ? { left: 52, right: hasRightAxis ? 52 : 22, top: 38, bottom: gridBottom, containLabel: true }
        : { left: 64, right: hasRightAxis ? 64 : 28, top: 56, bottom: gridBottom, containLabel: true },
    dataZoom: compact || thumbnail
      ? []
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
        ? { fontSize: 10, margin: 6, hideOverlap: true, rotate: xValues.length > 8 ? 20 : 0, formatter: (value: string) => formatTimeLabel(value, xValues) }
        : { fontSize: dense ? 10 : undefined, color: '#475569', margin: dense ? 6 : 8, hideOverlap: true, rotate: xValues.length > 12 ? (dense ? 20 : 24) : 0, formatter: (value: string) => formatTimeLabel(value, xValues) },
      axisTick: { show: true, alignWithLabel: true },
      axisLine: { show: true }
    },
    yAxis: [
      {
        type: 'value',
        name: compact ? '' : visualDsl.leftAxisName,
        axisLabel: compact ? { fontSize: 10, margin: 8, color: '#475569' } : { fontSize: dense ? 10 : undefined, color: '#475569', margin: dense ? 8 : 10, hideOverlap: true },
        axisTick: { show: true },
        axisLine: { show: true },
        splitNumber: compact ? 4 : undefined
      },
      {
        type: 'value',
        name: compact ? '' : visualDsl.rightAxisName,
        show: hasRightAxis,
        axisLabel: compact ? { fontSize: 10, margin: 8, color: '#475569' } : { fontSize: dense ? 10 : undefined, color: '#475569', margin: dense ? 8 : 10, hideOverlap: true },
        axisTick: { show: true },
        axisLine: { show: true },
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
