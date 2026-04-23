import type {
  ComponentDslConfig,
  DashboardComponent,
  DatasetModel,
  MetricSetting,
  TableBodyCellDsl,
  TableConditionalFormatDsl,
  TableDesignerColumnDsl,
  TableDsl,
  TableLayoutDsl,
  TableTemplateDsl
} from '../types/dashboard';
import { getDefaultTableColumnFields, normalizeDisplayText } from './dashboardText';

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
    emptyText: '当前条件下暂无数据'
  };
}

function getFieldLabel(model: DatasetModel | undefined, fieldCode: string) {
  const field = model?.fields.find(item => item.fieldCode === fieldCode);
  return normalizeDisplayText(field?.fieldName, fieldCode);
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

export function normalizeTableDsl(
  dslConfig: ComponentDslConfig,
  model?: DatasetModel
): TableDsl {
  const tableDsl = dslConfig.tableDsl ?? createDefaultTableDsl();
  const template = {
    ...createDefaultTableTemplateDsl(),
    ...tableDsl.template
  };
  const dimensionFields = dslConfig.queryDsl.dimensionFields;
  const columns = (tableDsl.columns?.length
    ? tableDsl.columns
    : buildTableColumnsFromQuery(dimensionFields, dslConfig.queryDsl.metrics, model)).map(column => ({
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
    emptyText: normalizeDisplayText(tableDsl.emptyText, '当前条件下暂无数据')
  };
}

export function normalizeTableLayoutDsl(layoutDsl?: TableLayoutDsl, tableDsl?: TableDsl): TableLayoutDsl {
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

export function syncTableComponentWithModel(
  component: DashboardComponent,
  normalizeDsl: (dslConfig: ComponentDslConfig, model?: DatasetModel) => ComponentDslConfig,
  model?: DatasetModel,
  previewRows: Record<string, unknown>[] = []
) {
  const normalized = normalizeDsl(component.dslConfig, model);
  const currentColumnFields = normalized.tableDsl?.template?.columnFields ?? [];
  const nextColumnFields = currentColumnFields.length > 0
    ? currentColumnFields
    : getDefaultTableColumnFields(model);
  normalized.queryDsl = {
    ...normalized.queryDsl,
    dimensionFields: nextColumnFields,
    metrics: []
  };
  const seededTableDsl: TableDsl = {
    ...(normalized.tableDsl ?? createDefaultTableDsl()),
    template: {
      ...createDefaultTableTemplateDsl(),
      ...normalized.tableDsl?.template,
      rowFields: [],
      columnFields: nextColumnFields,
      valueFields: [],
      threshold: normalized.tableDsl?.template?.threshold ?? 0,
      gtColor: normalized.tableDsl?.template?.gtColor ?? '#fecaca',
      lteColor: normalized.tableDsl?.template?.lteColor ?? '#dcfce7'
    }
  };
  const nextTableDsl = buildInitialTableDsl({
    ...component,
    dslConfig: {
      ...normalized,
      tableDsl: seededTableDsl
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
