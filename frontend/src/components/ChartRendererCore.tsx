import { Empty } from 'antd';
import * as echarts from 'echarts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getChartTemplate } from '../charting/templateRegistry';
import type { ChartPreview, DashboardComponent, DataPool, TableBodyCellDsl, TableMergeDsl, TableStyleRule } from '../types/dashboard';
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
  const merge = merges.find(item => item.region === cell.region && item.rowIndex === cell.rowIndex && item.colIndex === cell.colIndex);
  return {
    rowSpan: merge?.rowSpan ?? 1,
    colSpan: merge?.colSpan ?? 1
  };
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
    text: String(cell.textOverride ?? cell.text ?? cell.sourceText ?? cell.value ?? ''),
    value: cell.value,
    fieldCode: cell.fieldCode
  }));
  const fullRowCount = Math.max(1, ...bodyCells.map(cell => cell.rowIndex + 1), 1);
  const rowCount = thumbnail ? Math.min(fullRowCount, 5) : fullRowCount;
  const colCount = Math.max(1, ...bodyCells.map(cell => cell.colIndex + 1), 1);
  const merges = tableDsl.merges ?? [];
  const styleMap = tableDsl.styles ?? {};

  const resolveStyle = (cell: GridCell) => {
    const style = (styleMap[cellStyleKey(cell.region, cell.rowIndex, cell.colIndex)] as TableStyleRule | undefined) ?? {};
    const matched = cell.rowIndex === 0 ? undefined : (tableDsl.conditionalFormats ?? []).find(rule => {
      if (rule.target && rule.target !== 'body' && rule.target !== 'all') return false;
      if (rule.fieldCode && rule.fieldCode !== cell.fieldCode) return false;
      const numeric = Number(cell.value ?? cell.text);
      if (!Number.isFinite(numeric)) return false;
      return compareRule(rule.operator, numeric, rule.value);
    });
    return matched ? { ...style, ...matched.style } : style;
  };

  return (
    <div className="chart-renderer-shell chart-renderer-table">
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
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
  const template = useMemo(() => getChartTemplate(props.templateCode), [props.templateCode]);
  const option = useMemo(
    () => props.preview && template.buildOption ? template.buildOption(props.preview, { zoomRange, activeLayerId: props.activeLayerId, compact: props.thumbnail }) : undefined,
    [props.activeLayerId, props.preview, props.thumbnail, template, zoomRange]
  );
  const resizeChart = useCallback(() => {
    window.requestAnimationFrame(() => {
      const host = hostRef.current;
      if (!host || host.clientWidth === 0 || host.clientHeight === 0) return;
      chartRef.current?.resize({ width: host.clientWidth, height: host.clientHeight });
    });
  }, []);
  const shouldRenderChart = props.viewMode !== 'table' && template.renderer !== 'table' && Boolean(option);

  useEffect(() => {
    if (!props.preview) {
      setZoomRange({ start: 0, end: 100 });
    }
  }, [props.preview]);

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
      setZoomRange(current => (
        Math.abs(current.start - next.start) < 0.01 && Math.abs(current.end - next.end) < 0.01
          ? current
          : next
      ));
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
    if (!shouldRenderChart || !option || !chartRef.current) return;
    chartRef.current.setOption(option, true);
    resizeChart();
  }, [option, resizeChart, shouldRenderChart]);

  useEffect(() => {
    resizeChart();
    const timer = window.setTimeout(resizeChart, 80);
    return () => window.clearTimeout(timer);
  }, [props.resizeTick, props.viewMode, resizeChart]);

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

  if (template.renderer === 'table' || props.viewMode === 'table') {
    return renderStaticTable(props.preview, props.thumbnail);
  }

  if (props.preview.rows.length === 0) {
    return <Empty description="当前条件下暂无数据" />;
  }

  return (
    <div className={`chart-renderer-shell${props.thumbnail ? ' chart-renderer-thumbnail' : ''}`}>
      <div ref={hostRef} className="chart-renderer-host" />
    </div>
  );
}
