import type { BarSeriesOption, EChartsOption, LineSeriesOption } from 'echarts';
import type { ChartPreview } from '../../types/dashboard';
import { formatNumberMax3 } from '../../utils/numberFormat';
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

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTooltipMarker(series: CartesianSeriesOption | undefined, color: string) {
  if (series?.type === 'bar') {
    return `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${escapeHtml(color)};margin-right:6px;vertical-align:-1px;"></span>`;
  }
  const lineStyle = (series as LineSeriesOption | undefined)?.lineStyle;
  const lineType = typeof lineStyle === 'object' && lineStyle && 'type' in lineStyle ? String(lineStyle.type ?? 'solid') : 'solid';
  const borderStyle = lineType === 'dashed' || lineType === 'dotted' ? lineType : 'solid';
  return `<span style="display:inline-block;width:24px;border-top:3px ${borderStyle} ${escapeHtml(color)};margin-right:6px;vertical-align:middle;"></span>`;
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
  const scrollWindowEnabled = Boolean(preview.dslConfig.dimensionConfigDsl.enableScrollWindow);
  const compact = Boolean(context?.compact);
  const dense = !compact && Boolean(context?.dense);
  const thumbnail = Boolean(context?.thumbnail);
  const forceSlider = scrollWindowEnabled && Boolean(context?.forceSlider);
  const forceDataZoom = scrollWindowEnabled && (Boolean(context?.forceDataZoom) || forceSlider);
  const enableSlider = forceSlider || (scrollWindowEnabled && interactionDsl.slider);
  const enableDataZoom = forceDataZoom || (scrollWindowEnabled && interactionDsl.dataZoom) || enableSlider;
  const showThumbnailSlider = thumbnail && enableDataZoom && enableSlider;
  let sliderStart = zoom.start;
  let sliderEnd = zoom.end;

  // In enlarged mode, default to a narrower recent window so the slider is immediately usable.
  if (forceSlider && sliderStart === 0 && sliderEnd === 100 && xValues.length > 18) {
    const visibleCount = Math.min(18, xValues.length);
    const visibleRatio = visibleCount / xValues.length;
    sliderStart = Math.max(0, 100 - (visibleRatio * 100));
    sliderEnd = 100;
  }
  const legendRightPadding = dense ? 112 : 140;
  const sliderBottom = thumbnail ? 18 : 0;
  const sliderHeight = thumbnail ? 26 : dense ? 28 : 36;
  const gridBottom = enableSlider ? (compact ? 52 : dense ? 48 : 64) : (compact ? 38 : dense ? 28 : 40);
  const thumbnailGrid = {
    left: 40,
    right: hasRightAxis ? 44 : 20,
    top: 16,
    bottom: showThumbnailSlider ? 104 : 34,
    containLabel: true
  };
  const series = [
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

      const nextSeries: CartesianSeriesOption = {
        name: buildSeriesName(metric, key),
        type,
        yAxisIndex: metric.yAxis === 'right' ? 1 : 0,
        data: xValues.map(x => Number(rowsByX.get(x)?.[metric.fieldCode] ?? 0)),
        stack: baseStackKey,
        itemStyle: { color: itemColor as never },
        lineStyle: { width: styleDsl.lineWidth, color: metric.color },
        smooth: type === 'line' ? metric.smooth : false,
        showSymbol: type === 'line' ? (metric.showSymbol ?? styleDsl.showSymbol) : undefined
      };

      if (metric.chartType === 'area') {
        return { ...nextSeries, areaStyle: { opacity: styleDsl.areaOpacity, color: metric.color } } as LineSeriesOption;
      }

      return nextSeries;
    })) as CartesianSeriesOption[]),
    ...buildStatisticItemSeries(preview, xField, xValues, activeLayerId, context)
  ];
  const seriesByName = new Map(series.map(item => [String(item.name ?? ''), item]));
  const legendData = series
    .map(item => String(item.name ?? ''))
    .filter(name => name && !name.startsWith('__helper__'));

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
      valueFormatter: value => formatNumberMax3(value),
      formatter: params => {
        const points = Array.isArray(params) ? params : [params];
        const firstPoint = points[0] as (typeof points)[number] & { axisValueLabel?: string };
        const title = escapeHtml(firstPoint?.axisValueLabel ?? firstPoint?.name ?? '');
        const rows = points
          .filter(point => point?.seriesName)
          .map(point => {
            const seriesOption = seriesByName.get(String(point.seriesName));
            const color = typeof point.color === 'string' ? point.color : '#64748b';
            return `<div style="display:flex;align-items:center;gap:4px;min-width:0;">
              ${renderTooltipMarker(seriesOption, color)}
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(point.seriesName)}</span>
              <strong style="margin-left:12px;">${escapeHtml(formatNumberMax3(point.value))}</strong>
            </div>`;
          })
          .join('');
        return `<div style="display:grid;gap:6px;max-width:${dense ? 180 : 320}px;">
          <div style="font-weight:700;color:#0f172a;">${title}</div>
          ${rows}
        </div>`;
      },
      extraCssText: dense ? 'max-width: 180px; white-space: normal; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);' : undefined
    },
    legend: compact || thumbnail || !interactionDsl.legend ? { show: false } : {
      top: dense ? 2 : 0,
      left: dense ? 8 : 12,
      right: legendRightPadding,
      type: 'scroll',
      data: legendData,
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
    dataZoom: compact
      ? []
      : enableDataZoom
        ? [
          ...((enableSlider && !thumbnail) || showThumbnailSlider ? [{
            type: 'slider' as const,
            start: sliderStart,
            end: sliderEnd,
            filterMode: 'filter' as const,
            height: sliderHeight,
            bottom: sliderBottom,
            showDetail: !thumbnail,
            brushSelect: false,
            fillerColor: thumbnail ? 'rgba(59, 130, 246, 0.16)' : 'rgba(191, 219, 254, 0.55)',
            borderColor: thumbnail ? 'rgba(148, 163, 184, 0.55)' : 'rgba(191, 219, 254, 0.75)',
            backgroundColor: thumbnail ? 'rgba(241, 245, 249, 0.92)' : 'rgba(239, 246, 255, 0.9)',
            dataBackground: thumbnail
              ? {
                  lineStyle: { color: 'rgba(148, 163, 184, 0.8)' },
                  areaStyle: { color: 'rgba(226, 232, 240, 0.9)' }
                }
              : {
                  lineStyle: { color: '#cbd5e1' },
                  areaStyle: { color: 'rgba(226, 232, 240, 0.85)' }
                },
            handleSize: '100%',
            moveHandleSize: thumbnail ? 0 : 14,
            handleStyle: thumbnail ? {
              color: '#dbeafe',
              borderColor: '#60a5fa',
              borderWidth: 2
            } : {
              color: '#dbeafe',
              borderColor: '#60a5fa',
              borderWidth: 2
            },
            moveHandleStyle: thumbnail ? undefined : {
              color: 'rgba(147, 197, 253, 0.22)',
              borderColor: '#bfdbfe'
            },
            textStyle: { color: '#475569', fontSize: thumbnail ? 9 : dense ? 9 : 11 },
            labelFormatter: (value: string | number) => formatTimeLabel(value, xValues)
          }] : []),
          ...(scrollWindowEnabled ? [{ type: 'inside' as const, start: sliderStart, end: sliderEnd, filterMode: 'filter' as const, zoomOnMouseWheel: !thumbnail }] : [])
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
        scale: true,
        name: compact ? '' : visualDsl.leftAxisName,
        axisLabel: compact ? { fontSize: 10, margin: 8, color: '#475569', formatter: value => formatNumberMax3(value) } : { fontSize: dense ? 10 : undefined, color: '#475569', margin: dense ? 8 : 10, hideOverlap: true, formatter: value => formatNumberMax3(value) },
        axisTick: { show: true },
        axisLine: { show: true },
        splitNumber: compact ? 4 : undefined
      },
      {
        type: 'value',
        scale: true,
        name: compact ? '' : visualDsl.rightAxisName,
        show: hasRightAxis,
        axisLabel: compact ? { fontSize: 10, margin: 8, color: '#475569', formatter: value => formatNumberMax3(value) } : { fontSize: dense ? 10 : undefined, color: '#475569', margin: dense ? 8 : 10, hideOverlap: true, formatter: value => formatNumberMax3(value) },
        axisTick: { show: true },
        axisLine: { show: true },
        splitNumber: compact ? 4 : undefined
      }
    ],
    series
  };
}
