import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Select } from 'antd';
import GridLayout from 'react-grid-layout';
import type { ChartPreview, DashboardComponent, DataPool } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import ChartContainer from './ChartContainer';
import ChartRendererCore from './ChartRendererCore';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const BOARD_COLS = 12;
const BOARD_WIDTH = 1200;
const BOARD_HEIGHT = 720;
const BOARD_ROWS = 12;
const BOARD_MARGIN = 16;
const BOARD_ROW_HEIGHT = (BOARD_HEIGHT - (BOARD_MARGIN * (BOARD_ROWS + 1))) / BOARD_ROWS;
interface DashboardCanvasProps {
  components: DashboardComponent[];
  previews: Record<string, ChartPreview>;
  editable: boolean;
  resizable?: boolean;
  dataPools?: DataPool[];
  selectedComponentCode?: string;
  onSelect: (componentCode: string) => void;
  onLayoutChange: (components: DashboardComponent[]) => void;
  onComponentChange?: (component: DashboardComponent) => void;
  onComponentPreview?: (component: DashboardComponent) => void;
  mode?: 'grid' | 'adaptive' | 'thumbnail';
  renderActions?: (component: DashboardComponent, activeLayerId?: string) => ReactNode;
  emptyContent?: ReactNode;
}

function renderComponentCard(
  component: DashboardComponent,
  preview: ChartPreview | undefined,
  editable: boolean,
  dataPools: DataPool[] | undefined,
  selectedComponentCode: string | undefined,
  activeLayerId: string | undefined,
  resizeTick: number,
  actions: ReactNode,
  onSelect: (componentCode: string) => void,
  onComponentChange?: (component: DashboardComponent) => void,
  onComponentPreview?: (component: DashboardComponent) => void,
  options?: { thumbnail?: boolean; hideHeader?: boolean }
) {
  return (
    <ChartContainer
      tag={normalizeDisplayText(component.dslConfig.visualDsl.indicatorTag)}
      title={normalizeDisplayText(component.dslConfig.visualDsl.title || component.title, component.componentCode)}
      selected={component.componentCode === selectedComponentCode}
      onClick={() => onSelect(component.componentCode)}
      extra={actions}
      hideHeader={options?.hideHeader}
    >
      <ChartRendererCore
        component={component}
        preview={preview}
        templateCode={component.templateCode}
        activeLayerId={activeLayerId}
        viewMode="chart"
        resizeTick={resizeTick}
        editable={editable}
        selected={component.componentCode === selectedComponentCode}
        dataPools={dataPools}
        onComponentChange={onComponentChange}
        onComponentPreview={onComponentPreview}
        thumbnail={options?.thumbnail}
      />
    </ChartContainer>
  );
}

function renderThumbnailCard(
  component: DashboardComponent,
  preview: ChartPreview | undefined,
  activeLayerId: string | undefined,
  resizeTick: number
) {
  return (
    <div className="thumbnail-render-card">
      <ChartRendererCore
        component={component}
        preview={preview}
        templateCode={component.templateCode}
        activeLayerId={activeLayerId}
        viewMode="chart"
        resizeTick={resizeTick}
        editable={false}
        selected={false}
        thumbnail
      />
    </div>
  );
}

function showLayerSelector(component: DashboardComponent) {
  return component.templateCode !== 'table' && component.componentType !== 'table';
}

function resolveActiveLayerId(
  component: DashboardComponent,
  activeLayers: Record<string, string>
) {
  const chartLayers = showLayerSelector(component)
    ? component.dslConfig.chartLayersDsl.filter(layer => layer.enabled)
    : [];
  const selectedLayerId = activeLayers[component.componentCode];
  const activeLayerId = chartLayers.find(layer => layer.id === selectedLayerId)?.id ?? chartLayers[0]?.id;

  return { chartLayers, activeLayerId };
}

export default function DashboardCanvas({
  components,
  previews,
  editable,
  resizable = true,
  dataPools,
  selectedComponentCode,
  onSelect,
  onLayoutChange,
  onComponentChange,
  onComponentPreview,
  mode = 'grid',
  renderActions,
  emptyContent
}: DashboardCanvasProps) {
  const [resizeTick, setResizeTick] = useState(0);
  const [activeLayers, setActiveLayers] = useState<Record<string, string>>({});
  const boardShellRef = useRef<HTMLDivElement | null>(null);
  const [boardScale, setBoardScale] = useState(1);

  const buildActions = (component: DashboardComponent, activeLayerId: string | undefined) => {
    const { chartLayers } = resolveActiveLayerId(component, activeLayers);

    return (
      <div className="chart-card-actions">
        {chartLayers.length > 0 ? (
          <Select
            size="small"
            style={{ minWidth: 150 }}
            value={activeLayerId}
            options={chartLayers.map(layer => ({ label: normalizeDisplayText(layer.layerName, layer.id), value: layer.id }))}
            onChange={value => setActiveLayers(state => ({ ...state, [component.componentCode]: value }))}
          />
        ) : null}
        {renderActions?.(component, activeLayerId)}
      </div>
    );
  };

  useEffect(() => {
    if (mode !== 'grid') {
      setBoardScale(1);
      return;
    }

    const host = boardShellRef.current;
    if (!host) {
      return;
    }

    const updateScale = (width: number) => {
      if (!Number.isFinite(width) || width <= 0) {
        return;
      }
      setBoardScale(Math.min(width / BOARD_WIDTH, 1));
    };

    updateScale(host.clientWidth);

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      updateScale(entry?.contentRect.width ?? host.clientWidth);
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, [mode]);

  if (components.length === 0) {
    return <div className="panel-card canvas-card canvas-empty">{emptyContent ?? '暂无内容'}</div>;
  }

  if (mode === 'thumbnail') {
    const component = components[0];
    const { activeLayerId } = resolveActiveLayerId(component, activeLayers);

    return (
      <div className="dashboard-thumbnail-shell">
        <div className="dashboard-thumbnail-viewport">
          <div className="dashboard-thumbnail-board">
            <div className="dashboard-thumbnail-item dashboard-thumbnail-item-full">
              {renderThumbnailCard(
                component,
                previews[component.componentCode],
                activeLayerId,
                resizeTick,
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'adaptive') {
    return (
      <div className="adaptive-canvas">
        {components.map(component => {
          const { activeLayerId } = resolveActiveLayerId(component, activeLayers);
          return (
            <div
              key={component.componentCode}
              className="adaptive-canvas-item"
              style={{
                gridColumn: `span ${Math.max(1, Math.min(12, component.dslConfig.layout.w || 6))}`,
                gridRow: `span ${Math.max(6, component.dslConfig.layout.h || 8)}`
              }}
              onMouseDownCapture={() => onSelect(component.componentCode)}
              onClickCapture={() => onSelect(component.componentCode)}
            >
              {renderComponentCard(
                component,
                previews[component.componentCode],
                editable,
                dataPools,
                selectedComponentCode,
                activeLayerId,
                resizeTick,
                buildActions(component, activeLayerId),
                onSelect,
                onComponentChange,
                onComponentPreview
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="panel-card canvas-card chart-board-stage">
      <div className="dashboard-fixed-board-shell" ref={boardShellRef}>
        <div className="dashboard-fixed-board-stage" style={{ height: BOARD_HEIGHT * boardScale }}>
          <div className="dashboard-fixed-board" style={{ transform: `scale(${boardScale})` }}>
          <GridLayout
            className="layout dashboard-fixed-grid"
            width={BOARD_WIDTH}
            cols={BOARD_COLS}
            maxRows={BOARD_ROWS}
            rowHeight={BOARD_ROW_HEIGHT}
            containerPadding={[0, 0]}
            isBounded={editable}
            isDraggable={editable}
            isResizable={editable && resizable}
            resizeHandles={resizable ? ['nw', 'ne', 'sw', 'se'] : []}
            draggableHandle=".component-card"
            draggableCancel="button,input,textarea,select,option,.ant-input,.ant-input-number,.ant-select,.ant-table,.chart-toggle,.chart-card-actions,.chart-host,.chart-renderer-shell,.chart-renderer-host,canvas,svg,.table-designer-shell,.table-designer-preview,.designer-grid-table,.designer-cell"
            margin={[BOARD_MARGIN, BOARD_MARGIN]}
            layout={components.map(component => ({ i: component.componentCode, ...component.dslConfig.layout }))}
            onLayoutChange={layout => {
              onLayoutChange(components.map(component => {
                const next = layout.find(item => item.i === component.componentCode);
                return next
                  ? { ...component, dslConfig: { ...component.dslConfig, layout: { x: next.x, y: next.y, w: next.w, h: next.h } } }
                  : component;
              }));
              setResizeTick(value => value + 1);
            }}
          >
            {components.map(component => {
              const { activeLayerId } = resolveActiveLayerId(component, activeLayers);
              return (
                <div
                  key={component.componentCode}
                  className="component-grid-item"
                  onMouseDownCapture={() => onSelect(component.componentCode)}
                  onClickCapture={() => onSelect(component.componentCode)}
                >
                  {renderComponentCard(
                    component,
                    previews[component.componentCode],
                    editable,
                    dataPools,
                    selectedComponentCode,
                    activeLayerId,
                    resizeTick,
                    buildActions(component, activeLayerId),
                    onSelect,
                    onComponentChange,
                    onComponentPreview
                  )}
                </div>
              );
            })}
          </GridLayout>
          </div>
        </div>
      </div>
    </div>
  );
}
