import { Button, Card, Collapse, ColorPicker, Empty, Input, InputNumber, Select, Space, Switch } from 'antd';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  ChartPreview,
  DashboardComponent,
  DataPool,
  FieldMeta,
  MetricSetting,
  StatisticAxis,
  StatisticBandConfig,
  StatisticLineConfig,
  StatisticalItemDsl,
  TemplateDefinition
} from '../types/dashboard';
import {
  createChartLayer,
  createStatisticItem,
  getDefaultTableColumnFields,
  normalizeDslConfig,
  normalizeStatisticItemName,
  resolveModel,
  syncTableComponentWithModel
} from '../utils/dashboard';
import TableDesignerPanel from './TableDesignerPanel';

type ConfigModuleKey = 'base' | 'layers' | 'dim_metric' | 'mean' | 'std' | 'percentile';
type StatisticScopeKey = 'visible' | 'rolling';
type StatisticConfigKey = 'mean' | 'std1' | 'std2' | 'percentile';

const COLOR_PRESETS = [
  {
    label: 'Palette',
    colors: [
      '#5470C6', '#91CC75', '#FAC858', '#EE6666', '#73C0DE',
      '#3BA272', '#FC8452', '#9A60B4', '#EA7CCC', '#1d4ed8',
      '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#111827'
    ]
  }
];

const SERIES_TYPE_OPTIONS = [
  { label: '折线', value: 'line' },
  { label: '面积', value: 'area' },
  { label: '柱状', value: 'bar' }
];

const AXIS_OPTIONS: Array<{ label: string; value: StatisticAxis | MetricSetting['yAxis'] }> = [
  { label: '左轴', value: 'left' },
  { label: '右轴', value: 'right' }
];

const LINE_STYLE_OPTIONS = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
];

function ModuleSparkline(props: { module: ConfigModuleKey }) {
  const palette: Record<ConfigModuleKey, { stroke: string; fill: string }> = {
    base: { stroke: '#0f172a', fill: '#94a3b8' },
    layers: { stroke: '#0f766e', fill: '#2dd4bf' },
    dim_metric: { stroke: '#1d4ed8', fill: '#60a5fa' },
    mean: { stroke: '#dc2626', fill: '#fb7185' },
    std: { stroke: '#0ea5e9', fill: '#7dd3fc' },
    percentile: { stroke: '#7c3aed', fill: '#c4b5fd' }
  };
  const { stroke, fill } = palette[props.module];

  if (props.module === 'mean') {
    return <svg width="88" height="28" viewBox="0 0 88 28" aria-hidden="true"><path d="M2 20 L18 12 L34 18 L50 8 L66 14 L86 6" fill="none" stroke={stroke} strokeWidth="2" /><path d="M2 14 L86 14" fill="none" stroke={fill} strokeWidth="2" strokeDasharray="4 3" /></svg>;
  }
  if (props.module === 'std') {
    return <svg width="88" height="28" viewBox="0 0 88 28" aria-hidden="true"><path d="M2 14 L86 14" fill="none" stroke={stroke} strokeWidth="2" /><path d="M2 8 L86 8" fill="none" stroke={fill} strokeWidth="1.8" strokeDasharray="4 3" /><path d="M2 20 L86 20" fill="none" stroke={fill} strokeWidth="1.8" strokeDasharray="4 3" /><rect x="2" y="9" width="84" height="10" fill={fill} opacity="0.12" /></svg>;
  }
  if (props.module === 'percentile') {
    return <svg width="88" height="28" viewBox="0 0 88 28" aria-hidden="true"><path d="M2 22 C 16 22, 20 8, 34 8 S 52 22, 64 18 S 74 8, 86 8" fill="none" stroke={stroke} strokeWidth="2" /><path d="M2 24 L86 24" fill="none" stroke="#e5e7eb" strokeWidth="1" /></svg>;
  }
  if (props.module === 'layers') {
    return <svg width="88" height="28" viewBox="0 0 88 28" aria-hidden="true"><rect x="10" y="6" width="64" height="6" rx="3" fill={fill} opacity="0.3" /><rect x="6" y="12" width="72" height="6" rx="3" fill={fill} opacity="0.5" /><rect x="12" y="18" width="60" height="6" rx="3" fill={fill} opacity="0.7" /></svg>;
  }
  if (props.module === 'dim_metric') {
    return <svg width="88" height="28" viewBox="0 0 88 28" aria-hidden="true"><path d="M10 22 L10 6" stroke={fill} strokeWidth="2" /><path d="M10 22 L78 22" stroke={fill} strokeWidth="2" /><rect x="18" y="14" width="8" height="8" fill={fill} opacity="0.6" /><rect x="32" y="10" width="8" height="12" fill={fill} opacity="0.7" /><rect x="46" y="16" width="8" height="6" fill={fill} opacity="0.6" /><path d="M18 12 L34 8 L50 12 L66 6" fill="none" stroke={stroke} strokeWidth="2" /></svg>;
  }
  return <svg width="88" height="28" viewBox="0 0 88 28" aria-hidden="true"><rect x="10" y="6" width="22" height="6" rx="3" fill={fill} opacity="0.7" /><rect x="10" y="14" width="42" height="6" rx="3" fill={fill} opacity="0.5" /><rect x="10" y="22" width="32" height="4" rx="2" fill={fill} opacity="0.35" /></svg>;
}

function ColorBoard(props: { value: string; onChange: (hex: string) => void }) {
  return (
    <ColorPicker
      value={props.value}
      format="hex"
      presets={COLOR_PRESETS as never}
      onChangeComplete={(color: unknown) => {
        const hex = typeof color === 'string' ? color : (color as { toHexString?: () => string })?.toHexString?.() ?? String(color);
        props.onChange(hex);
      }}
    />
  );
}

function FieldLabel(props: { children: ReactNode }) {
  return <div className="metric-field-label">{props.children}</div>;
}

function isDimensionField(field: FieldMeta) {
  return field.fieldRole === 'dimension' || ['date', 'datetime', 'string'].includes(field.dataType);
}

function isMetricField(field: FieldMeta) {
  return field.fieldRole === 'metric' || field.dataType === 'number';
}

function sanitizeComponent(component: DashboardComponent): DashboardComponent {
  const normalized = { ...component, dslConfig: normalizeDslConfig(component.dslConfig) };
  const chartLayers = normalized.dslConfig.chartLayersDsl.length > 0 ? normalized.dslConfig.chartLayersDsl : [createChartLayer(0)];
  const enabledLayers = chartLayers.some(layer => layer.enabled) ? chartLayers : chartLayers.map((layer, index) => ({ ...layer, enabled: index === 0 }));
  const validLayerIds = enabledLayers.map(layer => layer.id);
  const fallbackLayerIds = validLayerIds[0] ? [validLayerIds[0]] : [];
  const metrics = normalized.dslConfig.queryDsl.metrics;
  const firstMetricCode = metrics[0]?.fieldCode ?? '';
  const keepLayerIds = (layerIds: string[]) => {
    const next = layerIds.filter(layerId => validLayerIds.includes(layerId));
    return next.length > 0 ? next : fallbackLayerIds;
  };

  return {
    ...normalized,
    dslConfig: {
      ...normalized.dslConfig,
      chartLayersDsl: enabledLayers,
      queryDsl: {
        ...normalized.dslConfig.queryDsl,
        metrics: metrics.map(metric => ({ ...metric, layerIds: keepLayerIds(metric.layerIds) }))
      },
      dimensionConfigDsl: {
        ...normalized.dslConfig.dimensionConfigDsl,
        layerIds: keepLayerIds(normalized.dslConfig.dimensionConfigDsl.layerIds)
      },
      statisticalItemsDsl: normalized.dslConfig.statisticalItemsDsl.map((item, index) => {
        const defaults = createStatisticItem(fallbackLayerIds, firstMetricCode, index);
        const metricFieldCode = metrics.some(metric => metric.fieldCode === item.metricFieldCode) ? item.metricFieldCode ?? '' : firstMetricCode;
        const keep = (layerIds: string[] | undefined) => keepLayerIds(Array.isArray(layerIds) ? layerIds : []);
        const mergeLine = (base: StatisticLineConfig, patch?: Partial<StatisticLineConfig>) => ({ ...base, ...patch, yAxis: patch?.yAxis === 'right' ? 'right' : base.yAxis, layerIds: keep(patch?.layerIds ?? base.layerIds) });
        const mergeBand = (base: StatisticBandConfig, patch?: Partial<StatisticBandConfig>) => ({ ...mergeLine(base, patch), bandColor: patch?.bandColor ?? base.bandColor });
        const mergeScope = (base: StatisticalItemDsl['visible'], patch: any) => ({
          mean: mergeLine(base.mean, patch?.mean),
          std1: mergeBand(base.std1, patch?.std1),
          std2: mergeBand(base.std2, patch?.std2),
          percentile: mergeLine(base.percentile, patch?.percentile)
        });
        return {
          ...defaults,
          ...item,
          itemName: normalizeStatisticItemName(item.itemName, index),
          metricFieldCode,
          rollingWindowYears: Number(item.rollingWindowYears ?? defaults.rollingWindowYears ?? 3),
          visible: mergeScope(defaults.visible, item.visible),
          rolling: mergeScope(defaults.rolling, item.rolling)
        };
      })
    }
  };
}

function buildLinePanel(
  component: DashboardComponent,
  index: number,
  scope: StatisticScopeKey,
  key: 'mean' | 'percentile',
  title: string,
  config: StatisticLineConfig,
  layerOptions: Array<{ label: string; value: string }>,
  updateStatistic: (index: number, updater: (item: StatisticalItemDsl) => StatisticalItemDsl) => void,
  updateStatisticConfig: (index: number, scope: StatisticScopeKey, key: StatisticConfigKey, patch: Partial<StatisticLineConfig | StatisticBandConfig>) => void,
  rolling?: boolean
) {
  return {
    key: `${scope}-${key}`,
    label: title,
    children: (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {rolling ? (
          <div>
            <FieldLabel>滚动年数 N</FieldLabel>
            <InputNumber
              style={{ width: '100%' }}
              min={0.5}
              step={0.5}
              value={component.dslConfig.statisticalItemsDsl[index].rollingWindowYears}
              onChange={value => updateStatistic(index, currentItem => ({ ...currentItem, rollingWindowYears: Number(value ?? currentItem.rollingWindowYears ?? 3) }))}
            />
          </div>
        ) : null}
        <Space wrap style={{ width: '100%' }}>
          <Space>
            <span className="metric-field-label">启用</span>
            <Switch checked={config.enabled} onChange={checked => updateStatisticConfig(index, scope, key, { enabled: checked })} />
          </Space>
          <Select style={{ width: 110 }} value={config.yAxis} options={AXIS_OPTIONS} onChange={value => updateStatisticConfig(index, scope, key, { yAxis: value as StatisticAxis })} />
          <Select style={{ width: 120 }} value={config.lineStyle} options={LINE_STYLE_OPTIONS} onChange={value => updateStatisticConfig(index, scope, key, { lineStyle: value as StatisticLineConfig['lineStyle'] })} />
        </Space>
        <div>
          <FieldLabel>图层</FieldLabel>
          <Select mode="multiple" style={{ width: '100%' }} value={config.layerIds} options={layerOptions} placeholder="选择图层" onChange={value => updateStatisticConfig(index, scope, key, { layerIds: value })} />
        </div>
        <div>
          <FieldLabel>颜色</FieldLabel>
          <ColorBoard value={config.lineColor} onChange={hex => updateStatisticConfig(index, scope, key, { lineColor: hex })} />
        </div>
      </Space>
    )
  };
}

function buildBandPanel(
  component: DashboardComponent,
  index: number,
  scope: StatisticScopeKey,
  key: 'std1' | 'std2',
  title: string,
  config: StatisticBandConfig,
  layerOptions: Array<{ label: string; value: string }>,
  updateStatistic: (index: number, updater: (item: StatisticalItemDsl) => StatisticalItemDsl) => void,
  updateStatisticConfig: (index: number, scope: StatisticScopeKey, key: StatisticConfigKey, patch: Partial<StatisticLineConfig | StatisticBandConfig>) => void,
  rolling?: boolean
) {
  return {
    key: `${scope}-${key}`,
    label: title,
    children: (
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {rolling ? (
          <div>
            <FieldLabel>滚动年数 N</FieldLabel>
            <InputNumber style={{ width: '100%' }} min={0.5} step={0.5} value={component.dslConfig.statisticalItemsDsl[index].rollingWindowYears} onChange={value => updateStatistic(index, currentItem => ({ ...currentItem, rollingWindowYears: Number(value ?? currentItem.rollingWindowYears ?? 3) }))} />
          </div>
        ) : null}
        <Space wrap style={{ width: '100%' }}>
          <Space>
            <span className="metric-field-label">启用</span>
            <Switch checked={config.enabled} onChange={checked => updateStatisticConfig(index, scope, key, { enabled: checked })} />
          </Space>
          <Select style={{ width: 110 }} value={config.yAxis} options={AXIS_OPTIONS} onChange={value => updateStatisticConfig(index, scope, key, { yAxis: value as StatisticAxis })} />
          <Select style={{ width: 120 }} value={config.lineStyle} options={LINE_STYLE_OPTIONS} onChange={value => updateStatisticConfig(index, scope, key, { lineStyle: value as StatisticBandConfig['lineStyle'] })} />
        </Space>
        <div>
          <FieldLabel>图层</FieldLabel>
          <Select mode="multiple" style={{ width: '100%' }} value={config.layerIds} options={layerOptions} placeholder="选择图层" onChange={value => updateStatisticConfig(index, scope, key, { layerIds: value })} />
        </div>
        <Space wrap>
          <div><FieldLabel>线条颜色</FieldLabel><ColorBoard value={config.lineColor} onChange={hex => updateStatisticConfig(index, scope, key, { lineColor: hex })} /></div>
          <div><FieldLabel>区间颜色</FieldLabel><ColorBoard value={config.bandColor} onChange={hex => updateStatisticConfig(index, scope, key, { bandColor: hex })} /></div>
        </Space>
      </Space>
    )
  };
}

export default function ChartConfigPanel(props: { component?: DashboardComponent; dataPools: DataPool[]; templates: TemplateDefinition[]; preview?: ChartPreview; onChange: (component: DashboardComponent) => void; onPreview: () => void; }) {
  const component = props.component ? sanitizeComponent(props.component) : undefined;
  const [activeModule, setActiveModule] = useState<ConfigModuleKey>('base');

  useEffect(() => {
    setActiveModule('base');
  }, [component?.componentCode]);

  if (!component) {
    return <div className="config-panel-shell"><div className="panel-card property-panel property-panel-empty"><div className="panel-section"><Empty description="请选择一个图表" /></div></div></div>;
  }

  const activeTemplate = props.templates.find(template => template.templateCode === component.templateCode);
  const templateRenderer = activeTemplate?.capability?.renderer ?? activeTemplate?.rendererCode ?? 'cartesian_combo';
  const model = resolveModel(props.dataPools, component.modelCode);

  if (templateRenderer === 'table' || component.templateCode === 'table' || component.componentType === 'table') {
    return (
      <TableDesignerPanel
        component={component}
        dataPools={props.dataPools}
        templates={props.templates}
        previewRows={props.preview?.rows}
        onChange={props.onChange}
        onPreview={props.onPreview}
      />
    );
  }

  const isCartesianTemplate = templateRenderer === 'cartesian_combo';
  const fields = model?.fields ?? [];
  const dimensionFields = fields.filter(isDimensionField);
  const metricFields = fields.filter(isMetricField);
  const layerOptions = component.dslConfig.chartLayersDsl.map(layer => ({ label: layer.layerName, value: layer.id }));
  const cartesianTemplateCode = props.templates.find(template => (template.capability?.renderer ?? template.rendererCode) === 'cartesian_combo')?.templateCode ?? 'cartesian_combo';
  const templateOptions = [
    { label: '笛卡尔坐标图', value: cartesianTemplateCode },
    { label: '表格', value: 'table' }
  ];
  const modelOptions = props.dataPools.map(dataPool => ({ label: dataPool.dataPoolName, value: dataPool.modelCode }));
  const dimensionOptions = dimensionFields.map(field => ({ label: field.fieldName || field.fieldCode, value: field.fieldCode }));
  const metricOptions = metricFields.map(field => ({ label: field.fieldName || field.fieldCode, value: field.fieldCode }));
  const metricBindingOptions = component.dslConfig.queryDsl.metrics.map(metric => ({ label: metric.displayName || metric.fieldCode, value: metric.fieldCode }));

  const applyComponent = (updater: (current: DashboardComponent) => DashboardComponent) => props.onChange(sanitizeComponent(updater(component)));
  const updateMetric = (index: number, updater: (metric: MetricSetting) => MetricSetting) => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, queryDsl: { ...current.dslConfig.queryDsl, metrics: current.dslConfig.queryDsl.metrics.map((metric, metricIndex) => (metricIndex === index ? updater(metric) : metric)) } } }));
  const updateStatistic = (index: number, updater: (item: StatisticalItemDsl) => StatisticalItemDsl) => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, statisticalItemsDsl: current.dslConfig.statisticalItemsDsl.map((item, itemIndex) => (itemIndex === index ? updater(item) : item)) } }));
  const updateStatisticConfig = (index: number, scope: StatisticScopeKey, key: StatisticConfigKey, patch: Partial<StatisticLineConfig | StatisticBandConfig>) => updateStatistic(index, currentItem => ({ ...currentItem, [scope]: { ...currentItem[scope], [key]: { ...currentItem[scope][key], ...patch } } }));

  const statisticPanelItems = (item: StatisticalItemDsl, index: number) => {
    if (activeModule === 'mean') {
      return [
        buildLinePanel(component, index, 'visible', 'mean', '视图范围均值线', item.visible.mean, layerOptions, updateStatistic, updateStatisticConfig),
        buildLinePanel(component, index, 'rolling', 'mean', '滚动均值线', item.rolling.mean, layerOptions, updateStatistic, updateStatisticConfig, true)
      ];
    }
    if (activeModule === 'std') {
      return [
        buildBandPanel(component, index, 'visible', 'std1', '视图范围标准差区间 ±1σ', item.visible.std1, layerOptions, updateStatistic, updateStatisticConfig),
        buildBandPanel(component, index, 'visible', 'std2', '视图范围标准差区间 ±2σ', item.visible.std2, layerOptions, updateStatistic, updateStatisticConfig),
        buildBandPanel(component, index, 'rolling', 'std1', '滚动标准差区间 ±1σ', item.rolling.std1, layerOptions, updateStatistic, updateStatisticConfig, true),
        buildBandPanel(component, index, 'rolling', 'std2', '滚动标准差区间 ±2σ', item.rolling.std2, layerOptions, updateStatistic, updateStatisticConfig, true)
      ];
    }
    return [
      buildLinePanel(component, index, 'visible', 'percentile', '视图范围分位点线', item.visible.percentile, layerOptions, updateStatistic, updateStatisticConfig),
      buildLinePanel(component, index, 'rolling', 'percentile', '滚动分位点线', item.rolling.percentile, layerOptions, updateStatistic, updateStatisticConfig, true)
    ];
  };

  const moduleCards = [{ key: 'base' as const, title: '基础配置' }, ...(isCartesianTemplate ? [{ key: 'layers' as const, title: '图层' }, { key: 'dim_metric' as const, title: '维度指标' }, { key: 'mean' as const, title: '均值线' }, { key: 'std' as const, title: '标准差区间' }, { key: 'percentile' as const, title: '分位点线' }] : [])];

  return (
    <div className="config-panel-shell">
      <div className="panel-card property-panel">
        <div className="property-panel-scroll">
          <div className="panel-section">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
              {moduleCards.map(module => (
                <Card key={module.key} size="small" hoverable onClick={() => setActiveModule(module.key)} style={{ cursor: 'pointer', borderColor: activeModule === module.key ? '#111827' : undefined }} bodyStyle={{ padding: 10 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <ModuleSparkline module={module.key} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: activeModule === module.key ? '#111827' : '#6b7280' }}>{module.title}</div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {activeModule === 'base' ? (
            <div className="panel-section">
              <h3 className="panel-title">基础配置</h3>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div><FieldLabel>图表标题</FieldLabel><Input value={component.dslConfig.visualDsl.title} onChange={event => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, visualDsl: { ...current.dslConfig.visualDsl, title: event.target.value } } }))} /></div>
                <div><FieldLabel>指标标签</FieldLabel><Input value={component.dslConfig.visualDsl.indicatorTag} onChange={event => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, visualDsl: { ...current.dslConfig.visualDsl, indicatorTag: event.target.value } } }))} /></div>
                <div><FieldLabel>图表模板</FieldLabel><Select style={{ width: '100%' }} value={component.templateCode} options={templateOptions} onChange={value => applyComponent(current => {
                  if (value !== 'table') {
                    return {
                      ...current,
                      templateCode: value
                    };
                  }

                  const nextModel = resolveModel(props.dataPools, current.modelCode);
                  const defaultColumnFields = getDefaultTableColumnFields(nextModel);

                  return syncTableComponentWithModel(
                    {
                      ...current,
                      templateCode: 'table',
                      componentType: 'table',
                      dslConfig: {
                        ...current.dslConfig,
                        queryDsl: {
                          ...current.dslConfig.queryDsl,
                          modelCode: current.modelCode,
                          dimensionFields: defaultColumnFields,
                          metrics: []
                        }
                      }
                    },
                    nextModel,
                    props.preview?.rows ?? []
                  );
                })} /></div>
                <div><FieldLabel>数据模型</FieldLabel><Select style={{ width: '100%' }} value={component.modelCode} options={modelOptions} onChange={value => applyComponent(current => ({
                  ...current,
                  modelCode: value,
                  dslConfig: {
                    ...current.dslConfig,
                    queryDsl: {
                      ...current.dslConfig.queryDsl,
                      modelCode: value
                    }
                  }
                }))} /></div>
              </Space>
            </div>
          ) : null}

          {isCartesianTemplate && activeModule === 'layers' ? (
            <div className="panel-section"><h3 className="panel-title">图层</h3><Space direction="vertical" size={12} style={{ width: '100%' }}>
              {component.dslConfig.chartLayersDsl.map((layer, index) => (
                <Card key={layer.id} size="small" title={`图层 ${index + 1}`} extra={component.dslConfig.chartLayersDsl.length > 1 ? <Button size="small" danger onClick={() => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, chartLayersDsl: current.dslConfig.chartLayersDsl.filter(item => item.id !== layer.id) } }))}>删除</Button> : null}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Input value={layer.layerName} onChange={event => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, chartLayersDsl: current.dslConfig.chartLayersDsl.map(item => (item.id === layer.id ? { ...item, layerName: event.target.value } : item)) } }))} />
                    <Space><span className="metric-field-label">启用</span><Switch checked={layer.enabled} onChange={checked => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, chartLayersDsl: current.dslConfig.chartLayersDsl.map(item => (item.id === layer.id ? { ...item, enabled: checked } : item)) } }))} /></Space>
                  </Space>
                </Card>
              ))}
              <Button block onClick={() => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, chartLayersDsl: [...current.dslConfig.chartLayersDsl, createChartLayer(current.dslConfig.chartLayersDsl.length)] } }))}>新建图层</Button>
            </Space></div>
          ) : null}

          {isCartesianTemplate && activeModule === 'dim_metric' ? (
            <>
              <div className="panel-section"><h3 className="panel-title">维度</h3><Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div><FieldLabel>维度字段</FieldLabel><Select mode="multiple" maxCount={2} style={{ width: '100%' }} value={component.dslConfig.queryDsl.dimensionFields} options={dimensionOptions} onChange={value => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, queryDsl: { ...current.dslConfig.queryDsl, dimensionFields: value } } }))} /></div>
                <div><FieldLabel>所在图层</FieldLabel><Select mode="multiple" style={{ width: '100%' }} value={component.dslConfig.dimensionConfigDsl.layerIds} options={layerOptions} onChange={value => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, dimensionConfigDsl: { ...current.dslConfig.dimensionConfigDsl, layerIds: value } } }))} /></div>
                <Space><span className="metric-field-label">第二维度堆叠</span><Switch checked={component.dslConfig.dimensionConfigDsl.stackBySecondDimension} onChange={checked => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, dimensionConfigDsl: { ...current.dslConfig.dimensionConfigDsl, stackBySecondDimension: checked } } }))} /></Space>
              </Space></div>

              <div className="panel-section"><h3 className="panel-title">指标</h3><Space direction="vertical" size={12} style={{ width: '100%' }}>
                {component.dslConfig.queryDsl.metrics.map((metric, index) => (
                  <Card key={`${metric.fieldCode}-${index}`} size="small" title={metric.displayName || metric.fieldCode || `指标 ${index + 1}`} extra={component.dslConfig.queryDsl.metrics.length > 1 ? <Button size="small" danger onClick={() => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, queryDsl: { ...current.dslConfig.queryDsl, metrics: current.dslConfig.queryDsl.metrics.filter((_, metricIndex) => metricIndex !== index) } } }))}>删除</Button> : null}>
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Select style={{ width: '100%' }} value={metric.fieldCode} options={metricOptions} onChange={value => updateMetric(index, currentMetric => { const field = metricFields.find(item => item.fieldCode === value); return { ...currentMetric, fieldCode: value, displayName: field?.fieldName || value }; })} />
                      <Input value={metric.displayName} placeholder="显示名称" onChange={event => updateMetric(index, currentMetric => ({ ...currentMetric, displayName: event.target.value }))} />
                      <Space.Compact style={{ width: '100%' }}>
                        <Select style={{ width: '35%' }} value={metric.chartType} options={SERIES_TYPE_OPTIONS} onChange={value => updateMetric(index, currentMetric => ({ ...currentMetric, chartType: value as MetricSetting['chartType'] }))} />
                        <Select style={{ width: '30%' }} value={metric.yAxis} options={AXIS_OPTIONS} onChange={value => updateMetric(index, currentMetric => ({ ...currentMetric, yAxis: value as MetricSetting['yAxis'] }))} />
                        <div style={{ width: '35%', display: 'flex', justifyContent: 'flex-end', paddingRight: 4 }}><ColorBoard value={metric.color} onChange={hex => updateMetric(index, currentMetric => ({ ...currentMetric, color: hex }))} /></div>
                      </Space.Compact>
                      {metric.chartType === 'bar' ? <div><FieldLabel>负值颜色</FieldLabel><ColorBoard value={metric.negativeColor || '#dc2626'} onChange={hex => updateMetric(index, currentMetric => ({ ...currentMetric, negativeColor: hex }))} /></div> : null}
                      <div><FieldLabel>图层</FieldLabel><Select mode="multiple" style={{ width: '100%' }} value={metric.layerIds} options={layerOptions} placeholder="选择图层" onChange={value => updateMetric(index, currentMetric => ({ ...currentMetric, layerIds: value }))} /></div>
                      <Space><span className="metric-field-label">平滑</span><Switch checked={metric.smooth} onChange={checked => updateMetric(index, currentMetric => ({ ...currentMetric, smooth: checked }))} /></Space>
                    </Space>
                  </Card>
                ))}
                <Button block onClick={() => { const field = metricFields[0]; if (!field) return; applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, queryDsl: { ...current.dslConfig.queryDsl, metrics: [...current.dslConfig.queryDsl.metrics, { fieldCode: field.fieldCode, displayName: field.fieldName || field.fieldCode, aggType: field.aggType || 'sum', chartType: 'line', yAxis: 'left', color: '#1d4ed8', negativeColor: '#dc2626', smooth: false, layerIds: current.dslConfig.chartLayersDsl[0] ? [current.dslConfig.chartLayersDsl[0].id] : [] }] } } })); }}>新增指标</Button>
              </Space></div>
            </>
          ) : null}

          {isCartesianTemplate && (activeModule === 'mean' || activeModule === 'std' || activeModule === 'percentile') ? (
            <div className="panel-section"><h3 className="panel-title">指标统计量</h3><Space direction="vertical" size={12} style={{ width: '100%' }}>
              {component.dslConfig.statisticalItemsDsl.map((item, index) => (
                <Card key={item.id} size="small" title={item.itemName || `统计量${index + 1}`} extra={component.dslConfig.statisticalItemsDsl.length > 1 ? <Button size="small" danger onClick={() => applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, statisticalItemsDsl: current.dslConfig.statisticalItemsDsl.filter((_, itemIndex) => itemIndex !== index) } }))}>删除</Button> : null}>
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Input value={item.itemName} placeholder={`统计量${index + 1}`} onChange={event => updateStatistic(index, currentItem => ({ ...currentItem, itemName: event.target.value }))} />
                    <Select style={{ width: '100%' }} value={item.metricFieldCode} options={metricBindingOptions} onChange={value => updateStatistic(index, currentItem => ({ ...currentItem, metricFieldCode: value }))} />
                    <Collapse items={statisticPanelItems(item, index)} defaultActiveKey={statisticPanelItems(item, index).map(panel => panel.key)} />
                  </Space>
                </Card>
              ))}
              <Button block onClick={() => { const firstMetricCode = component.dslConfig.queryDsl.metrics[0]?.fieldCode; applyComponent(current => ({ ...current, dslConfig: { ...current.dslConfig, statisticalItemsDsl: [...current.dslConfig.statisticalItemsDsl, { ...createStatisticItem(current.dslConfig.chartLayersDsl[0] ? [current.dslConfig.chartLayersDsl[0].id] : [], firstMetricCode, current.dslConfig.statisticalItemsDsl.length), itemName: `统计量${current.dslConfig.statisticalItemsDsl.length + 1}` }] } })); }}>新增统计量</Button>
            </Space></div>
          ) : null}
        </div>

        <div className="panel-section property-panel-footer"><Space><Button type="primary" onClick={props.onPreview}>刷新预览</Button></Space></div>
      </div>
    </div>
  );
}
