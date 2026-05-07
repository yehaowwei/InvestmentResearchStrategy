import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import { Button, Empty } from 'antd';
import * as echarts from 'echarts';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { getChartTemplate } from '../charting/templateRegistry';
import type {
  ChartPreview,
  DashboardComponent,
  DataPool,
  TableBodyCellDsl,
  TableMergeDsl,
  TableStyleRule
} from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import { formatNumberMax3 } from '../utils/numberFormat';
import InteractiveTableDesigner from './InteractiveTableDesigner';

function readZoomRange(chart: echarts.EChartsType) {
  const option = chart.getOption();
  const dataZoom = Array.isArray(option.dataZoom) ? option.dataZoom[0] : undefined;
  const start = typeof dataZoom?.start === 'number' ? dataZoom.start : 0;
  const end = typeof dataZoom?.end === 'number' ? dataZoom.end : 100;
  return { start, end };
}

type TableRegion = 'body';

interface GridCell {
  key: string;
  region: TableRegion;
  rowIndex: number;
  colIndex: number;
  text: string;
  value?: unknown;
  fieldCode?: string;
}

function cellStyleKey(region: TableRegion, rowIndex: number, colIndex: number) {
  return `${region}:${rowIndex}:${colIndex}`;
}

function compareRule(operator: string, value: number, ruleValue: number) {
  switch (operator) {
    case 'gt': return value > ruleValue;
    case 'gte': return value >= ruleValue;
    case 'lt': return value < ruleValue;
    case 'lte': return value <= ruleValue;
    case 'eq': return value === ruleValue;
    default: return false;
  }
}

function matchesMerge(merge: TableMergeDsl, cell: GridCell) {
  return merge.region === cell.region
    && cell.rowIndex >= merge.rowIndex
    && cell.rowIndex < merge.rowIndex + merge.rowSpan
    && cell.colIndex >= merge.colIndex
    && cell.colIndex < merge.colIndex + merge.colSpan;
}

function shouldHideCell(merges: TableMergeDsl[], cell: GridCell) {
  const merge = merges.find(item => matchesMerge(item, cell));
  return Boolean(merge && !(merge.rowIndex === cell.rowIndex && merge.colIndex === cell.colIndex));
}

function getCellSpan(merges: TableMergeDsl[], cell: GridCell) {
  const merge = merges.find(item => (
    item.region === cell.region
    && item.rowIndex === cell.rowIndex
    && item.colIndex === cell.colIndex
  ));
  return {
    rowSpan: merge?.rowSpan ?? 1,
    colSpan: merge?.colSpan ?? 1
  };
}

interface ThumbnailLegendItem {
  key: string;
  label: string;
  color: string;
  marker: 'line' | 'bar';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
}

interface LegendPosition {
  x: number;
  y: number;
}

function buildThumbnailLegendItems(preview: ChartPreview, activeLayerId?: string): ThumbnailLegendItem[] {
  const metricMap = new Map(preview.dslConfig.queryDsl.metrics.map(metric => [metric.fieldCode, metric]));
  const items: ThumbnailLegendItem[] = [];
  const pushItem = (
    key: string,
    label: string,
    color: string,
    marker: ThumbnailLegendItem['marker'] = 'line',
    lineStyle: ThumbnailLegendItem['lineStyle'] = 'solid'
  ) => {
    if (items.some(item => item.key === key)) {
      return;
    }
    items.push({ key, label, color, marker, lineStyle });
  };
  const matchesLayer = (layerIds: string[]) => !activeLayerId || layerIds.includes(activeLayerId);

  preview.dslConfig.queryDsl.metrics
    .filter(metric => matchesLayer(metric.layerIds))
    .forEach(metric => {
      pushItem(
        `metric-${metric.fieldCode}`,
        normalizeDisplayText(metric.displayName, metric.fieldCode),
        metric.color,
        metric.chartType === 'bar' ? 'bar' : 'line',
        'solid'
      );
    });

  preview.dslConfig.statisticalItemsDsl.forEach(item => {
    const metric = metricMap.get(item.metricFieldCode ?? '') ?? preview.dslConfig.queryDsl.metrics[0];
    if (!metric) {
      return;
    }
    const metricName = normalizeDisplayText(metric.displayName, metric.fieldCode);

    if (item.visible.mean.enabled && matchesLayer(item.visible.mean.layerIds)) {
      pushItem(`${item.id}-visible-mean`, `${metricName}均值`, item.visible.mean.lineColor, 'line', item.visible.mean.lineStyle);
    }
    if (item.visible.std1.enabled && matchesLayer(item.visible.std1.layerIds)) {
      pushItem(`${item.id}-visible-std1`, `${metricName}±1σ`, item.visible.std1.lineColor, 'line', item.visible.std1.lineStyle);
    }
    if (item.visible.std2.enabled && matchesLayer(item.visible.std2.layerIds)) {
      pushItem(`${item.id}-visible-std2`, `${metricName}±2σ`, item.visible.std2.lineColor, 'line', item.visible.std2.lineStyle);
    }
    if (item.visible.percentile.enabled && matchesLayer(item.visible.percentile.layerIds)) {
      pushItem(`${item.id}-visible-percentile`, `${metricName}分位点`, item.visible.percentile.lineColor, 'line', item.visible.percentile.lineStyle);
    }
    if (item.rolling.mean.enabled && matchesLayer(item.rolling.mean.layerIds)) {
      pushItem(`${item.id}-rolling-mean`, `${metricName}滚动均值`, item.rolling.mean.lineColor, 'line', item.rolling.mean.lineStyle);
    }
    if (item.rolling.std1.enabled && matchesLayer(item.rolling.std1.layerIds)) {
      pushItem(`${item.id}-rolling-std1`, `${metricName}滚动±1σ`, item.rolling.std1.lineColor, 'line', item.rolling.std1.lineStyle);
    }
    if (item.rolling.std2.enabled && matchesLayer(item.rolling.std2.layerIds)) {
      pushItem(`${item.id}-rolling-std2`, `${metricName}滚动±2σ`, item.rolling.std2.lineColor, 'line', item.rolling.std2.lineStyle);
    }
    if (item.rolling.percentile.enabled && matchesLayer(item.rolling.percentile.layerIds)) {
      pushItem(`${item.id}-rolling-percentile`, `${metricName}滚动分位点`, item.rolling.percentile.lineColor, 'line', item.rolling.percentile.lineStyle);
    }
  });

  return items;
}

function renderStaticTable(preview: ChartPreview, thumbnail = false) {
  const tableDsl = preview.dslConfig.tableDsl;
  if (!tableDsl) {
    return <Empty description="暂无表格配置" />;
  }

  const bodyCells: GridCell[] = (tableDsl.bodyCells ?? []).map((cell: TableBodyCellDsl) => ({
    key: cell.key,
    region: 'body',
    rowIndex: cell.rowIndex,
    colIndex: cell.colIndex,
    text: String(cell.textOverride ?? formatNumberMax3(cell.value ?? cell.text ?? cell.sourceText)),
    value: cell.value,
    fieldCode: cell.fieldCode
  }));
  const fullRowCount = Math.max(1, ...bodyCells.map(cell => cell.rowIndex + 1), 1);
  const rowCount = thumbnail ? Math.min(fullRowCount, 8) : fullRowCount;
  const colCount = Math.max(1, ...bodyCells.map(cell => cell.colIndex + 1), 1);
  const merges = tableDsl.merges ?? [];
  const styleMap = tableDsl.styles ?? {};

  const resolveStyle = (cell: GridCell) => {
    const style = (styleMap[cellStyleKey(cell.region, cell.rowIndex, cell.colIndex)] as TableStyleRule | undefined) ?? {};
    const matched = cell.rowIndex === 0 ? undefined : (tableDsl.conditionalFormats ?? []).find(rule => {
      if (rule.target && rule.target !== 'body' && rule.target !== 'all') {
        return false;
      }
      if (rule.fieldCode && rule.fieldCode !== cell.fieldCode) {
        return false;
      }
      const numeric = Number(cell.value ?? cell.text);
      if (!Number.isFinite(numeric)) {
        return false;
      }
      return compareRule(rule.operator, numeric, rule.value);
    });
    return matched ? { ...style, ...matched.style } : style;
  };

  return (
    <div className={`chart-renderer-shell chart-renderer-table${thumbnail ? ' chart-renderer-thumbnail' : ''}`}>
      <div className="table-designer-preview">
        <table className="designer-grid-table">
          <tbody>
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <tr key={`body-${rowIndex}`}>
                {Array.from({ length: colCount }).map((__, colIndex) => {
                  const cell = bodyCells.find(item => item.rowIndex === rowIndex && item.colIndex === colIndex) ?? {
                    key: `body-${rowIndex}-${colIndex}`,
                    region: 'body' as const,
                    rowIndex,
                    colIndex,
                    text: ''
                  };
                  if (shouldHideCell(merges, cell)) {
                    return null;
                  }
                  const span = getCellSpan(merges, cell);
                  const style = resolveStyle(cell);
                  return (
                    <td
                      key={cell.key}
                      rowSpan={span.rowSpan}
                      colSpan={span.colSpan}
                      className="designer-cell"
                      style={{
                        background: style.backgroundColor,
                        color: style.color,
                        textAlign: style.textAlign,
                        fontWeight: style.fontWeight
                      }}
                    >
                      {cell.text || <span className="designer-cell-placeholder"> </span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ChartRendererCore(props: {
  component?: DashboardComponent;
  preview?: ChartPreview;
  templateCode: string;
  activeLayerId?: string;
  viewMode?: 'chart' | 'table';
  resizeTick?: number;
  editable?: boolean;
  selected?: boolean;
  dataPools?: DataPool[];
  onComponentChange?: (component: DashboardComponent) => void;
  onComponentPreview?: (component: DashboardComponent) => void;
  thumbnail?: boolean;
  compact?: boolean;
  dense?: boolean;
  forceSlider?: boolean;
  forceDataZoom?: boolean;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const zoomRangeRef = useRef<{ start: number; end: number }>({ start: 0, end: 100 });
  const [thumbnailLegendVisible, setThumbnailLegendVisible] = useState(false);
  const [thumbnailLegendPosition, setThumbnailLegendPosition] = useState<LegendPosition>({ x: 10, y: 34 });
  const thumbnailMode = Boolean(props.thumbnail);
  const compactMode = props.compact ?? thumbnailMode;
  const template = useMemo(() => getChartTemplate(props.templateCode), [props.templateCode]);
  const effectiveViewMode = (
    props.viewMode === 'table'
    || props.templateCode === 'table'
    || props.component?.templateCode === 'table'
    || props.component?.componentType === 'table'
  ) ? 'table' : 'chart';
  const thumbnailLegendItems = useMemo(
    () => (thumbnailMode && props.preview ? buildThumbnailLegendItems(props.preview, props.activeLayerId) : []),
    [props.activeLayerId, props.preview, thumbnailMode]
  );
  const option = useMemo(
    () => props.preview && template.buildOption
      ? template.buildOption(props.preview, {
        zoomRange: zoomRangeRef.current,
        activeLayerId: props.activeLayerId,
        compact: compactMode,
        dense: props.dense,
        thumbnail: thumbnailMode,
        forceSlider: props.forceSlider,
        forceDataZoom: props.forceDataZoom
      })
      : undefined,
    [compactMode, props.activeLayerId, props.dense, props.forceDataZoom, props.forceSlider, props.preview, template, thumbnailMode]
  );

  const resizeChart = useCallback(() => {
    window.requestAnimationFrame(() => {
      const host = hostRef.current;
      if (!host || host.clientWidth === 0 || host.clientHeight === 0) {
        return;
      }
      chartRef.current?.resize({ width: host.clientWidth, height: host.clientHeight });
    });
  }, []);

  const clampLegendPosition = useCallback((position: LegendPosition) => {
    const shell = shellRef.current;
    if (!shell) {
      return position;
    }
    const panel = shell.querySelector('.chart-thumbnail-legend-floating') as HTMLDivElement | null;
    const shellWidth = shell.clientWidth;
    const shellHeight = shell.clientHeight;
    const panelWidth = panel?.offsetWidth ?? 220;
    const panelHeight = panel?.offsetHeight ?? 140;
    return {
      x: Math.min(Math.max(8, position.x), Math.max(8, shellWidth - panelWidth - 8)),
      y: Math.min(Math.max(30, position.y), Math.max(30, shellHeight - panelHeight - 8))
    };
  }, []);

  const shouldRenderChart = effectiveViewMode !== 'table' && template.renderer !== 'table' && Boolean(option);

  useEffect(() => {
    if (!props.preview) {
      zoomRangeRef.current = { start: 0, end: 100 };
    }
  }, [props.preview]);

  useEffect(() => {
    if (!thumbnailLegendVisible) {
      return;
    }
    const timer = window.setTimeout(() => {
      setThumbnailLegendPosition(current => clampLegendPosition(current));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [clampLegendPosition, thumbnailLegendItems.length, thumbnailLegendVisible]);

  useEffect(() => {
    if (!shouldRenderChart || !hostRef.current) {
      observerRef.current?.disconnect();
      observerRef.current = null;
      chartRef.current?.dispose();
      chartRef.current = null;
      return;
    }

    const chart = chartRef.current ?? echarts.init(hostRef.current);
    chartRef.current = chart;
    const syncZoom = () => {
      const next = readZoomRange(chart);
      zoomRangeRef.current = next;
    };

    chart.on('datazoom', syncZoom);
    const observer = new ResizeObserver(resizeChart);
    observer.observe(hostRef.current);
    if (hostRef.current.parentElement) {
      observer.observe(hostRef.current.parentElement);
    }
    observerRef.current = observer;
    window.addEventListener('resize', resizeChart);

    return () => {
      chart.off('datazoom', syncZoom);
      observer.disconnect();
      observerRef.current = null;
      window.removeEventListener('resize', resizeChart);
    };
  }, [shouldRenderChart, resizeChart]);

  useEffect(() => {
    if (!shouldRenderChart || !option || !chartRef.current) {
      return;
    }
    chartRef.current.setOption(option, true);
    resizeChart();
  }, [option, resizeChart, shouldRenderChart]);

  useEffect(() => {
    resizeChart();
    const timer = window.setTimeout(resizeChart, 80);
    return () => window.clearTimeout(timer);
  }, [effectiveViewMode, props.resizeTick, resizeChart]);

  if (
    template.renderer === 'table'
    && props.editable
    && props.component
    && props.dataPools
    && props.onComponentChange
    && props.onComponentPreview
  ) {
    return (
      <InteractiveTableDesigner
        component={props.component}
        previewRows={props.preview?.rows ?? []}
        dataPools={props.dataPools}
        selected={Boolean(props.selected)}
        onChange={props.onComponentChange}
        onPreview={props.onComponentPreview}
      />
    );
  }

  if (!props.preview) {
    return <Empty description="等待预览数据" />;
  }

  if (template.renderer === 'table' || effectiveViewMode === 'table') {
    return renderStaticTable(props.preview, thumbnailMode);
  }

  if (props.preview.rows.length === 0) {
    return <Empty description="当前条件下暂无数据" />;
  }

  const startLegendDrag = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const originY = event.clientY;
    const originPosition = thumbnailLegendPosition;

    const handleMove = (moveEvent: MouseEvent) => {
      setThumbnailLegendPosition(clampLegendPosition({
        x: originPosition.x + (moveEvent.clientX - originX),
        y: originPosition.y + (moveEvent.clientY - originY)
      }));
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div ref={shellRef} className={`chart-renderer-shell${props.thumbnail ? ' chart-renderer-thumbnail' : ''}`}>
      {thumbnailMode && shouldRenderChart && thumbnailLegendItems.length > 0 ? (
        <div className="chart-thumbnail-toolbar">
          <Button
            size="small"
            type={thumbnailLegendVisible ? 'primary' : 'default'}
            icon={thumbnailLegendVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onMouseDown={event => event.stopPropagation()}
            onClick={event => {
              event.stopPropagation();
              setThumbnailLegendVisible(value => !value);
            }}
          >
            {thumbnailLegendVisible ? '隐藏图例' : '显示图例'}
          </Button>
        </div>
      ) : null}
      {thumbnailMode && thumbnailLegendVisible && thumbnailLegendItems.length > 0 ? (
        <div
          className="chart-thumbnail-legend-floating"
          style={{ left: thumbnailLegendPosition.x, top: thumbnailLegendPosition.y }}
          onMouseDown={event => event.stopPropagation()}
          onClick={event => event.stopPropagation()}
        >
          <div className="chart-thumbnail-legend-drag" onMouseDown={startLegendDrag}>
            图例
          </div>
          <div className="chart-thumbnail-legend">
            {thumbnailLegendItems.map(item => (
              <span key={item.key} className="chart-thumbnail-legend-item">
                <span
                  className={`chart-thumbnail-legend-marker chart-thumbnail-legend-marker-${item.marker} chart-thumbnail-legend-line-${item.lineStyle ?? 'solid'}`}
                  style={{ color: item.color, backgroundColor: item.marker === 'bar' ? item.color : undefined }}
                />
                <span className="chart-thumbnail-legend-label">{item.label}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div
        ref={hostRef}
        className="chart-renderer-host"
        style={{ minHeight: props.thumbnail ? 248 : 360 }}
      />
    </div>
  );
}
