import type { ReactNode } from 'react';
import { useState } from 'react';
import { Select } from 'antd';
import GridLayout, { WidthProvider } from 'react-grid-layout';
import type { ChartPreview, DashboardComponent, DataPool } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import ChartContainer from './ChartContainer';
import ChartRendererCore from './ChartRendererCore';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(GridLayout);

interface DashboardCanvasProps {
  components: DashboardComponent[];
  previews: Record<string, ChartPreview>;
  editable: boolean;
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

function showLayerSelector(component: DashboardComponent) {
  return component.templateCode !== 'table' && component.componentType !== 'table';
}

export default function DashboardCanvas({
  components,
  previews,
  editable,
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

  if (components.length === 0) {
    return <div className="panel-card canvas-card canvas-empty">{emptyContent ?? '暂无内容'}</div>;
  }

  if (mode === 'thumbnail') {
    const component = components[0];
    const chartLayers = showLayerSelector(component)
      ? component.dslConfig.chartLayersDsl.filter(layer => layer.enabled)
      : [];
    const selectedLayerId = activeLayers[component.componentCode];
    const activeLayerId = chartLayers.find(layer => layer.id === selectedLayerId)?.id ?? chartLayers[0]?.id;

    return (
      <div className="dashboard-thumbnail-shell">
        <div className="dashboard-thumbnail-viewport">
          <div className="dashboard-thumbnail-item dashboard-thumbnail-item-full">
            {renderComponentCard(
              component,
              previews[component.componentCode],
              false,
              dataPools,
              undefined,
              activeLayerId,
              resizeTick,
              null,
              onSelect,
              undefined,
              undefined,
              { thumbnail: true }
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'adaptive') {
    return (
      <div className="adaptive-canvas">
        {components.map(component => {
          const chartLayers = showLayerSelector(component)
            ? component.dslConfig.chartLayersDsl.filter(layer => layer.enabled)
            : [];
          const selectedLayerId = activeLayers[component.componentCode];
          const activeLayerId = chartLayers.find(layer => layer.id === selectedLayerId)?.id ?? chartLayers[0]?.id;
          const defaultActions = (
            <>
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
            </>
          );
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
                <div className="chart-card-actions">{defaultActions}</div>,
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
    <div className="panel-card canvas-card">
      <ResponsiveGridLayout
        className="layout"
        cols={12}
        rowHeight={44}
        isDraggable={editable}
        isResizable={editable}
        resizeHandles={['nw', 'ne', 'sw', 'se']}
        draggableHandle=".component-card"
        draggableCancel="button,input,textarea,select,option,.ant-input,.ant-input-number,.ant-select,.ant-table,.chart-toggle,.chart-card-actions,.chart-host,.chart-renderer-shell,.chart-renderer-host,canvas,svg,.table-designer-shell,.table-designer-preview,.designer-grid-table,.designer-cell"
        margin={[16, 16]}
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
          const chartLayers = showLayerSelector(component)
            ? component.dslConfig.chartLayersDsl.filter(layer => layer.enabled)
            : [];
          const selectedLayerId = activeLayers[component.componentCode];
          const activeLayerId = chartLayers.find(layer => layer.id === selectedLayerId)?.id ?? chartLayers[0]?.id;

          const defaultActions = (
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
                defaultActions,
                onSelect,
                onComponentChange,
                onComponentPreview
              )}
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
