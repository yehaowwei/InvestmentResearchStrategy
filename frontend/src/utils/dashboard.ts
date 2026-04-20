import type {
  ChartLayerDsl,
  ComponentDslConfig,
  DashboardComponent,
  DashboardDraft,
  DatasetModel,
  FilterCondition,
  MetricSetting,
  SortCondition,
  StatisticalItemDsl,
  TableBodyCellDsl,
  TableConditionalFormatDsl,
  TableDesignerColumnDsl,
  TableDsl,
  TableLayoutDsl,
  TableTemplateDsl,
  TemplateDefinition
} from '../types/dashboard';

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function resolveModel(models: DatasetModel[], modelCode?: string) {
  return models.find(model => model.modelCode === modelCode || model.datasetCode === modelCode || model.dataPoolCode === modelCode);
}

export function resolveTemplate(templates: TemplateDefinition[], templateCode?: string) {
  return templates.find(template => template.templateCode === templateCode);
}

export function getLayout(component: DashboardComponent) {
  return component.dslConfig.layout;
}

export function createChartLayer(index = 0): ChartLayerDsl {
  return {
    id: `chart-layer-${Date.now()}-${index}`,
    layerName: `图层 ${index + 1}`,
    enabled: true
  };
}

export function normalizeDisplayText(value?: string, fallback = '') {
  if (!value) return fallback;

  const chars = Array.from(value);
  if (chars.length === 0 || chars.some(char => char.charCodeAt(0) > 0xFF)) {
    return value;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(chars.map(char => char.charCodeAt(0))));
  } catch {
    return value;
  }
}

export function normalizeStatisticItemName(name: string | undefined, index: number) {
  const repairedName = normalizeDisplayText(name);
  if (!repairedName || /^(统计图层|指标统计量)\s*\d*$/.test(repairedName)) {
    return `统计量${index + 1}`;
  }
  return repairedName;
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

export function createStatisticItem(defaultLayerIds: string[], metricFieldCode?: string, index = 0): StatisticalItemDsl {
  return {
    id: `stat-item-${Date.now()}-${index}`,
    itemName: `统计量${index + 1}`,
    metricFieldCode: metricFieldCode || '',
    rollingWindowYears: 3,
    visible: {
      mean: {
        enabled: true,
        yAxis: 'left',
        lineColor: '#dc2626',
        lineStyle: 'solid',
        layerIds: defaultLayerIds
      },
      std1: {
        enabled: true,
        yAxis: 'left',
        lineColor: '#f97316',
        bandColor: '#fdba74',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds
      },
      std2: {
        enabled: true,
        yAxis: 'left',
        lineColor: '#fb7185',
        bandColor: '#fecdd3',
        lineStyle: 'dotted',
        layerIds: defaultLayerIds
      },
      percentile: {
        ...createPercentileConfig(),
        layerIds: defaultLayerIds
      }
    },
    rolling: {
      mean: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#FF9F7F',
        lineStyle: 'solid',
        layerIds: defaultLayerIds
      },
      std1: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#3BA272',
        bandColor: '#a7f3d0',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds
      },
      std2: {
        enabled: false,
        yAxis: 'left',
        lineColor: '#73C0DE',
        bandColor: '#bae6fd',
        lineStyle: 'dotted',
        layerIds: defaultLayerIds
      },
      percentile: {
        enabled: false,
        yAxis: 'right',
        lineColor: '#9A60B4',
        lineStyle: 'dashed',
        layerIds: defaultLayerIds
      }
    }
  };
}

function createDefaultMetric(fieldCode: string, displayName: string, index = 0): MetricSetting {
  const palette = ['#1d4ed8', '#0f766e', '#dc2626', '#7c3aed', '#f97316'];
  return {
    fieldCode,
    displayName,
    aggType: 'sum',
    chartType: 'table',
    yAxis: 'left',
    color: palette[index % palette.length],
    negativeColor: '#dc2626',
    smooth: false,
    layerIds: []
  };
}

function createDefaultTableLayoutDsl(): TableLayoutDsl {
  return {
    mode: 'list',
    frozenLeftCount: 0,
    frozenRightCount: 0,
    headerRowCount: 1,
    bodyRowCount: 12,
    gridColumns: [],
    gridRows: []
  };
}

function createDefaultConditionalFormats(): TableConditionalFormatDsl[] {
  return [];
}

function createDefaultTableTemplateDsl(): TableTemplateDsl {
  return {
    rowFields: [],
    columnFields: [],
    valueFields: [],
    threshold: 0,
    gtColor: '#fecaca',
    lteColor: '#dcfce7'
  };
}

function createDefaultTableDsl(): TableDsl {
  return {
    template: createDefaultTableTemplateDsl(),
    rowHeaders: [],
    columnHeaders: [],
    columns: [],
    headerGroups: [],
    headerCells: [],
    bodyCells: [],
    merges: [],
    styles: {},
    conditionalFormats: createDefaultConditionalFormats(),
    widgets: [],
    regionStyles: [],
    pagination: {
      enabled: true,
      pageSize: 12
    },
    summary: {
      enabled: false,
      label: '合计',
      metricFieldCodes: []
    },
    rowNumber: false,
    striped: false,
    bordered: true,
    size: 'small',
    rowSelection: false,
    emptyText: '暂无数据'
  };
}

function getFieldLabel(model: DatasetModel | undefined, fieldCode: string) {
  const field = model?.fields.find(item => item.fieldCode === fieldCode);
  return normalizeDisplayText(field?.fieldNameCn || field?.fieldName, fieldCode);
}

function buildDesignerColumns(
  fieldCodes: string[],
  model?: DatasetModel,
  previousColumns: TableDesignerColumnDsl[] = []
) {
  const previousMap = new Map(previousColumns.map(column => [column.id, column]));
  return fieldCodes.map((fieldCode, index) => {
    const id = `field-${fieldCode}`;
    const previous = previousMap.get(id);
    const field = model?.fields.find(item => item.fieldCode === fieldCode);
    const isNumeric = field?.fieldRole === 'metric' || field?.dataType === 'number';
    return {
      id,
      fieldCode,
      title: previous?.title || getFieldLabel(model, fieldCode),
      role: isNumeric ? ('metric' as const) : ('dimension' as const),
      width: previous?.width || (index === 0 ? 160 : 140),
      align: previous?.align || (isNumeric ? 'right' : 'left'),
      formatter: previous?.formatter || (isNumeric ? 'number' : 'text'),
      visible: previous?.visible ?? true,
      groupTitle: previous?.groupTitle || ''
    };
  });
}

function createEmptyBodyMatrix(columns: TableDesignerColumnDsl[], rowCount = 4): TableBodyCellDsl[] {
  const cells: TableBodyCellDsl[] = [];
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let colIndex = 0; colIndex < columns.length; colIndex += 1) {
      const column = columns[colIndex];
      const defaultText = rowIndex === 0 ? column.title : '';
      cells.push({
        key: `body-${rowIndex}-${colIndex}`,
        rowIndex,
        colIndex,
        fieldCode: rowIndex === 0 ? '' : column.fieldCode,
        text: defaultText,
        sourceText: defaultText,
        value: defaultText
      });
    }
  }
  return cells;
}

export function buildInitialTableDsl(
  component: DashboardComponent,
  model?: DatasetModel,
  previewRows: Record<string, unknown>[] = []
): TableDsl {
  const currentTableDsl = component.dslConfig.tableDsl ?? createDefaultTableDsl();
  const template = {
    ...createDefaultTableTemplateDsl(),
    ...currentTableDsl.template
  };
  const columnFields = template.columnFields;
  const previousBodyCellMap = new Map(
    (currentTableDsl.bodyCells ?? []).map(cell => [`${cell.rowIndex}:${cell.colIndex}`, cell])
  );

  if (columnFields.length === 0) {
    return {
      ...currentTableDsl,
      template,
      columns: [],
      headerGroups: [],
      headerCells: [],
      bodyCells: [],
      conditionalFormats: [],
      merges: []
    };
  }

  const columns = buildDesignerColumns(columnFields, model, currentTableDsl.columns);
  const conditionalTargets = columns.filter(column => column.role === 'metric').map(column => column.fieldCode);
  const bodyCells: TableBodyCellDsl[] = [];
  columns.forEach((column, colIndex) => {
    const previousCell = previousBodyCellMap.get(`0:${colIndex}`);
    const sourceText = column.title;
    bodyCells.push({
      key: `body-0-${colIndex}`,
      rowIndex: 0,
      colIndex,
      fieldCode: '',
      text: previousCell?.textOverride ?? sourceText,
      sourceText,
      textOverride: previousCell?.textOverride,
      value: sourceText
    });
  });

  previewRows.forEach((row, rowIndex) => {
    columnFields.forEach((fieldCode, colIndex) => {
      const nextRowIndex = rowIndex + 1;
      const previousCell = previousBodyCellMap.get(`${nextRowIndex}:${colIndex}`);
      const value = row[fieldCode];
      const sourceText = value == null ? '' : String(value);
      bodyCells.push({
        key: `body-${nextRowIndex}-${colIndex}`,
        rowIndex: nextRowIndex,
        colIndex,
        fieldCode,
        text: previousCell?.textOverride ?? sourceText,
        sourceText,
        textOverride: previousCell?.textOverride,
        value
      });
    });
  });

  return {
    ...currentTableDsl,
    template,
    rowHeaders: [],
    columnHeaders: columns.map(column => column.title),
    columns,
    headerGroups: [],
    headerCells: [],
    bodyCells: bodyCells.length > 0 ? bodyCells : createEmptyBodyMatrix(columns),
    conditionalFormats: conditionalTargets.flatMap(fieldCode => ([
      {
        key: `cf-gt-${fieldCode}`,
        fieldCode,
        target: 'body' as const,
        operator: 'gt' as const,
        value: template.threshold,
        style: { backgroundColor: template.gtColor }
      },
      {
        key: `cf-lte-${fieldCode}`,
        fieldCode,
        target: 'body' as const,
        operator: 'lte' as const,
        value: template.threshold,
        style: { backgroundColor: template.lteColor }
      }
    ])),
    merges: []
  };
}

export function buildTableColumnsFromQuery(
  dimensionFields: string[],
  metrics: MetricSetting[],
  model?: DatasetModel,
  previousColumns: TableDesignerColumnDsl[] = []
) {
  const previousMap = new Map(previousColumns.map(column => [column.fieldCode, column]));
  const dimensions = dimensionFields.map((fieldCode, index) => {
    const previous = previousMap.get(fieldCode);
    return {
      id: previous?.id || `table-col-d-${fieldCode}`,
      fieldCode,
      title: previous?.title || getFieldLabel(model, fieldCode),
      role: 'dimension' as const,
      width: previous?.width || (index === 0 ? 180 : 140),
      align: previous?.align || 'left',
      fixed: previous?.fixed,
      formatter: previous?.formatter || 'text',
      visible: previous?.visible ?? true,
      groupTitle: previous?.groupTitle || '维度'
    };
  });
  const metricColumns = metrics.map((metric, index) => {
    const previous = previousMap.get(metric.fieldCode);
    return {
      id: previous?.id || `table-col-m-${metric.fieldCode}`,
      fieldCode: metric.fieldCode,
      title: previous?.title || normalizeDisplayText(metric.displayName, metric.fieldCode),
      role: 'metric' as const,
      width: previous?.width || 140,
      align: previous?.align || 'right',
      fixed: previous?.fixed,
      formatter: previous?.formatter || 'number',
      visible: previous?.visible ?? true,
      groupTitle: previous?.groupTitle || (index === 0 ? '指标' : previous?.groupTitle || '指标')
    };
  });
  return [...dimensions, ...metricColumns];
}

function normalizeTableDsl(
  dslConfig: ComponentDslConfig,
  model?: DatasetModel
): TableDsl {
  const tableDsl = dslConfig.tableDsl ?? createDefaultTableDsl();
  const template = {
    ...createDefaultTableTemplateDsl(),
    ...tableDsl.template
  };
  const dimensionFields = dslConfig.queryDsl.dimensions?.length
    ? dslConfig.queryDsl.dimensions
    : dslConfig.queryDsl.dimensionFields;
  const columns = (tableDsl.columns?.length ? tableDsl.columns : buildTableColumnsFromQuery(dimensionFields, dslConfig.queryDsl.metrics, model)).map(column => ({
    ...column,
    title: normalizeDisplayText(column.title, column.fieldCode),
    visible: column.visible ?? true,
    align: column.align || (column.role === 'metric' ? 'right' : 'left'),
    formatter: column.formatter || (column.role === 'metric' ? 'number' : 'text'),
    groupTitle: normalizeDisplayText(column.groupTitle, column.role === 'metric' ? '指标' : '维度')
  }));
  return {
    ...createDefaultTableDsl(),
    ...tableDsl,
    template,
    rowHeaders: [...(tableDsl.rowHeaders ?? [])],
    columnHeaders: [...(tableDsl.columnHeaders ?? [])],
    columns,
    headerGroups: [...(tableDsl.headerGroups ?? [])],
    headerCells: [...(tableDsl.headerCells ?? [])],
    bodyCells: [...(tableDsl.bodyCells ?? [])],
    merges: [...(tableDsl.merges ?? [])],
    styles: tableDsl.styles ?? {},
    conditionalFormats: [...(tableDsl.conditionalFormats ?? [])],
    widgets: [...(tableDsl.widgets ?? [])],
    regionStyles: [...(tableDsl.regionStyles ?? [])],
    pagination: {
      enabled: tableDsl.pagination?.enabled ?? true,
      pageSize: tableDsl.pagination?.pageSize ?? 12
    },
    summary: {
      enabled: tableDsl.summary?.enabled ?? false,
      label: normalizeDisplayText(tableDsl.summary?.label, '合计'),
      metricFieldCodes: tableDsl.summary?.metricFieldCodes?.length
        ? tableDsl.summary.metricFieldCodes
        : dslConfig.queryDsl.metrics.map(metric => metric.fieldCode)
    },
    rowNumber: tableDsl.rowNumber ?? false,
    striped: tableDsl.striped ?? false,
    bordered: tableDsl.bordered ?? true,
    size: tableDsl.size ?? 'small',
    rowSelection: tableDsl.rowSelection ?? false,
    emptyText: normalizeDisplayText(tableDsl.emptyText, '暂无数据')
  };
}

function normalizeTableLayoutDsl(layoutDsl?: TableLayoutDsl, tableDsl?: TableDsl): TableLayoutDsl {
  const base = createDefaultTableLayoutDsl();
  const visibleColumns = tableDsl?.columns?.filter(column => column.visible !== false) ?? [];
  return {
    ...base,
    ...layoutDsl,
    mode: layoutDsl?.mode === 'report' ? 'report' : 'list',
    frozenLeftCount: Math.max(0, layoutDsl?.frozenLeftCount ?? base.frozenLeftCount),
    frozenRightCount: Math.max(0, layoutDsl?.frozenRightCount ?? base.frozenRightCount),
    headerRowCount: Math.max(1, layoutDsl?.headerRowCount ?? 1),
    bodyRowCount: Math.max(1, layoutDsl?.bodyRowCount ?? Math.max(visibleColumns.length, base.bodyRowCount)),
    gridColumns: layoutDsl?.gridColumns?.length ? layoutDsl.gridColumns : visibleColumns.map(column => column.fieldCode),
    gridRows: layoutDsl?.gridRows?.length ? layoutDsl.gridRows : ['header', 'body']
  };
}

export function createComponentFromTemplate(template: TemplateDefinition, modelCode: string, index: number): DashboardComponent {
  const dslConfig = normalizeDslConfig(deepClone(template.defaultDsl));
  const firstLayerId = dslConfig.chartLayersDsl[0]?.id || createChartLayer(0).id;
  const isTable = template.templateCode === 'table' || template.rendererCode === 'table' || template.capability?.renderer === 'table';
  dslConfig.queryDsl = {
    ...dslConfig.queryDsl,
    modelCode,
    datasetCode: modelCode,
    dimensionField: '',
    dimensionFields: [],
    dimensions: [],
    seriesFields: [],
    metrics: [],
    filters: [],
    orders: [],
    sorters: [],
    params: {}
  };
  dslConfig.dimensionConfigDsl = {
    ...dslConfig.dimensionConfigDsl,
    layerIds: [firstLayerId]
  };
  dslConfig.statisticalItemsDsl = [createStatisticItem([firstLayerId], '', index)];
  dslConfig.layout = {
    ...dslConfig.layout,
    y: index * 9
  };
  if (isTable) {
    dslConfig.layout = {
      ...dslConfig.layout,
      h: 10
    };
    dslConfig.layoutDsl = normalizeTableLayoutDsl();
    dslConfig.tableDsl = normalizeTableDsl(dslConfig);
  }

  return {
    componentCode: `cmp-${Date.now()}-${index}`,
    componentType: isTable ? 'table' : 'chart',
    templateCode: template.templateCode,
    modelCode,
    title: normalizeDisplayText(template.templateName, template.templateCode),
    dslConfig
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
    layerIds: metric.layerIds?.length ? metric.layerIds : defaultLayerIds
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

function normalizeChartLayers(chartLayers: ChartLayerDsl[] | undefined) {
  if (chartLayers?.length) {
    return chartLayers.map((layer, index) => ({
      id: layer.id || `chart-layer-${index}`,
      layerName: normalizeDisplayText(layer.layerName, `图层 ${index + 1}`),
      enabled: layer.enabled ?? true
    }));
  }
  return [createChartLayer(0)];
}

function normalizeStatisticItems(
  items: StatisticalItemDsl[] | undefined,
  defaultLayerIds: string[],
  firstMetricCode?: string,
  legacyLayers?: any[]
) {
  if (items?.length) {
    return items.map((item: any, index) => {
      const legacyLayerIds = Array.isArray(item.layerIds) && item.layerIds.length ? item.layerIds : defaultLayerIds;
      const rollingWindowYears = Number(item.rollingWindowYears ?? item.stdWindowYears ?? 3);
      const metricFieldCode = item.metricFieldCode || firstMetricCode || '';
      const wrapLine = (value: any, defaults: any) => ({
        enabled: value?.enabled ?? defaults.enabled,
        yAxis: value?.yAxis === 'right' ? 'right' : defaults.yAxis,
        lineColor: value?.lineColor || defaults.lineColor,
        lineStyle: value?.lineStyle ?? defaults.lineStyle,
        layerIds: Array.isArray(value?.layerIds) && value.layerIds.length ? value.layerIds : legacyLayerIds
      });
      const wrapBand = (value: any, defaults: any) => ({
        ...wrapLine(value, defaults),
        bandColor: value?.bandColor || defaults.bandColor
      });
      const defaultItem = createStatisticItem(defaultLayerIds, metricFieldCode, index);
      if (item.visible && item.rolling) {
        return {
          id: item.id || `stat-item-${index}`,
          itemName: normalizeStatisticItemName(item.itemName, index),
          metricFieldCode,
          rollingWindowYears: Number.isFinite(rollingWindowYears) && rollingWindowYears > 0 ? rollingWindowYears : 3,
          visible: {
            mean: wrapLine(item.visible.mean, defaultItem.visible.mean),
            std1: wrapBand(item.visible.std1, defaultItem.visible.std1),
            std2: wrapBand(item.visible.std2, defaultItem.visible.std2),
            percentile: wrapLine(
              item.visible.percentile ?? item.visible.quantiles?.find((q: any) => q.enabled),
              defaultItem.visible.percentile
            )
          },
          rolling: {
            mean: wrapLine(item.rolling.mean, defaultItem.rolling.mean),
            std1: wrapBand(item.rolling.std1, defaultItem.rolling.std1),
            std2: wrapBand(item.rolling.std2, defaultItem.rolling.std2),
            percentile: wrapLine(
              item.rolling.percentile ?? item.rolling.quantiles?.find((q: any) => q.enabled),
              defaultItem.rolling.percentile
            )
          }
        } as StatisticalItemDsl;
      }
      const legacyPercentile = item.percentile ?? (Array.isArray(item.quantiles) ? item.quantiles.find((q: any) => q.enabled) : undefined);
      return {
        id: item.id || `stat-item-${index}`,
        itemName: normalizeStatisticItemName(item.itemName, index),
        metricFieldCode,
        rollingWindowYears: Number.isFinite(rollingWindowYears) && rollingWindowYears > 0 ? rollingWindowYears : 3,
        visible: {
          mean: wrapLine(item.mean, defaultItem.visible.mean),
          std1: wrapBand(item.std1, defaultItem.visible.std1),
          std2: wrapBand(item.std2, defaultItem.visible.std2),
          percentile: wrapLine(legacyPercentile, defaultItem.visible.percentile)
        },
        rolling: {
          mean: wrapLine(undefined, defaultItem.rolling.mean),
          std1: wrapBand(undefined, defaultItem.rolling.std1),
          std2: wrapBand(undefined, defaultItem.rolling.std2),
          percentile: wrapLine(undefined, defaultItem.rolling.percentile)
        }
      } as StatisticalItemDsl;
    });
  }

  if (legacyLayers?.length) {
    return legacyLayers.map((layer: any, index) => {
      const metricFieldCode = layer.metricFieldCode || firstMetricCode || '';
      const defaultItem = createStatisticItem(defaultLayerIds, metricFieldCode, index);
      const layerIds = [layer.id || defaultLayerIds[0]].filter(Boolean);
      const wrapLine = (value: any, defaults: any) => ({
        enabled: value?.enabled ?? defaults.enabled,
        yAxis: value?.yAxis === 'right' ? 'right' : defaults.yAxis,
        lineColor: value?.lineColor || defaults.lineColor,
        lineStyle: value?.lineStyle ?? defaults.lineStyle,
        layerIds
      });
      const wrapBand = (value: any, defaults: any) => ({
        ...wrapLine(value, defaults),
        bandColor: value?.bandColor || defaults.bandColor
      });
      const legacyPercentile = layer.percentile ?? layer.quantiles?.find((q: any) => q.enabled);
      return {
        id: layer.id || `stat-item-${index}`,
        itemName: normalizeStatisticItemName(layer.layerName, index),
        metricFieldCode,
        rollingWindowYears: layer.stdWindowYears && layer.stdWindowYears > 0 ? layer.stdWindowYears : 3,
        visible: {
          mean: wrapLine(layer.mean, defaultItem.visible.mean),
          std1: wrapBand(layer.std1, defaultItem.visible.std1),
          std2: wrapBand(layer.std2, defaultItem.visible.std2),
          percentile: wrapLine(legacyPercentile, defaultItem.visible.percentile)
        },
        rolling: {
          mean: wrapLine(undefined, defaultItem.rolling.mean),
          std1: wrapBand(undefined, defaultItem.rolling.std1),
          std2: wrapBand(undefined, defaultItem.rolling.std2),
          percentile: wrapLine(undefined, defaultItem.rolling.percentile)
        }
      } as StatisticalItemDsl;
    });
  }

  return [createStatisticItem(defaultLayerIds, firstMetricCode, 0)];
}

export function normalizeDslConfig(
  dslConfig: ComponentDslConfig & { statisticalLayersDsl?: any[] },
  model?: DatasetModel
): ComponentDslConfig {
  const chartLayersDsl = normalizeChartLayers(dslConfig.chartLayersDsl);
  const defaultLayerIds = chartLayersDsl.map(layer => layer.id);
  const dimensionFields = dslConfig.queryDsl.dimensions?.length
    ? dslConfig.queryDsl.dimensions
    : dslConfig.queryDsl.dimensionFields?.length
      ? dslConfig.queryDsl.dimensionFields
      : dslConfig.queryDsl.dimensionField
        ? [dslConfig.queryDsl.dimensionField]
        : [];
  const metrics = (dslConfig.queryDsl.metrics ?? []).map((metric, index) => {
    if (!metric.fieldCode && typeof metric === 'string') {
      return createDefaultMetric(metric, metric, index);
    }
    return ensureMetricDefaults(metric, defaultLayerIds);
  });
  const firstMetric = metrics[0];
  const nextQueryDsl = {
    modelCode: dslConfig.queryDsl.modelCode,
    datasetCode: dslConfig.queryDsl.datasetCode ?? dslConfig.queryDsl.modelCode,
    dimensionField: dimensionFields[0] ?? dslConfig.queryDsl.dimensionField ?? '',
    dimensionFields,
    dimensions: dimensionFields,
    seriesFields: dslConfig.queryDsl.seriesFields ?? [],
    metrics,
    filters: (dslConfig.queryDsl.filters ?? []).map(ensureFilterDefaults),
    orders: (dslConfig.queryDsl.orders ?? dslConfig.queryDsl.sorters ?? []).map(ensureSortDefaults),
    sorters: (dslConfig.queryDsl.sorters ?? dslConfig.queryDsl.orders ?? []).map(ensureSortDefaults),
    params: dslConfig.queryDsl.params ?? {},
    limit: dslConfig.queryDsl.limit ?? 500
  };
  const normalized: ComponentDslConfig = {
    queryDsl: nextQueryDsl,
    dimensionConfigDsl: {
      stackBySecondDimension: dslConfig.dimensionConfigDsl?.stackBySecondDimension ?? false,
      layerIds: dslConfig.dimensionConfigDsl?.layerIds?.length ? dslConfig.dimensionConfigDsl.layerIds : defaultLayerIds
    },
    visualDsl: {
      title: normalizeDisplayText(dslConfig.visualDsl.title),
      subtitle: normalizeDisplayText(dslConfig.visualDsl.subtitle),
      xAxisName: normalizeDisplayText(dslConfig.visualDsl.xAxisName),
      leftAxisName: normalizeDisplayText(dslConfig.visualDsl.leftAxisName),
      rightAxisName: normalizeDisplayText(dslConfig.visualDsl.rightAxisName)
    },
    styleDsl: {
      showSymbol: dslConfig.styleDsl.showSymbol ?? false,
      lineWidth: dslConfig.styleDsl.lineWidth ?? 2,
      areaOpacity: dslConfig.styleDsl.areaOpacity ?? 0.2
    },
    interactionDsl: {
      tooltip: dslConfig.interactionDsl.tooltip ?? true,
      legend: dslConfig.interactionDsl.legend ?? true,
      dataZoom: dslConfig.interactionDsl.dataZoom ?? true,
      slider: dslConfig.interactionDsl.slider ?? true
    },
    chartLayersDsl,
    statisticalItemsDsl: normalizeStatisticItems(dslConfig.statisticalItemsDsl, defaultLayerIds, firstMetric?.fieldCode, dslConfig.statisticalLayersDsl),
    layout: {
      x: dslConfig.layout.x ?? 0,
      y: dslConfig.layout.y ?? 0,
      w: dslConfig.layout.w ?? 12,
      h: dslConfig.layout.h ?? 8
    }
  };
  const tableDsl = normalizeTableDsl({ ...normalized, tableDsl: dslConfig.tableDsl }, model);
  normalized.tableDsl = tableDsl;
  normalized.layoutDsl = normalizeTableLayoutDsl(dslConfig.layoutDsl, tableDsl);
  return normalized;
}

export function normalizeDashboard(draft: DashboardDraft, models: DatasetModel[] = []): DashboardDraft {
  return {
    ...draft,
    name: normalizeDisplayText(draft.name, draft.dashboardCode),
    components: draft.components.map(component => ({
      ...component,
      title: normalizeDisplayText(component.title, component.componentCode),
      dslConfig: normalizeDslConfig(
        component.dslConfig as ComponentDslConfig & { statisticalLayersDsl?: any[] },
        resolveModel(models, component.modelCode)
      )
    }))
  };
}

export function syncTableComponentWithModel(
  component: DashboardComponent,
  model?: DatasetModel,
  previewRows: Record<string, unknown>[] = []
) {
  const normalized = normalizeDslConfig(component.dslConfig, model);
  const nextTableDsl = buildInitialTableDsl({
    ...component,
    dslConfig: {
      ...normalized,
      tableDsl: normalized.tableDsl
    }
  }, model, previewRows);
  normalized.tableDsl = nextTableDsl;
  normalized.layoutDsl = normalizeTableLayoutDsl(normalized.layoutDsl, normalized.tableDsl);
  return {
    ...component,
    componentType: component.templateCode === 'table' ? 'table' : component.componentType,
    dslConfig: normalized
  };
}

