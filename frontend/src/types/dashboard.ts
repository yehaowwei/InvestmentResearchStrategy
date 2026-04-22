export type ChartSeriesType = 'line' | 'area' | 'bar' | 'scatter' | 'pie' | 'table';

export interface FieldMeta {
  fieldCode: string;
  fieldName: string;
  fieldNameCn?: string;
  dataType: string;
  fieldRole: 'dimension' | 'metric' | 'attribute';
  aggType?: string;
  sourceExpr: string;
  calcType?: 'avg' | 'sum' | 'max' | 'min' | 'rolling_3y_avg' | string;
  baseFieldCode?: string;
  aggs: string[];
}

export interface DatasetModel {
  dataPoolCode: string;
  dataPoolName: string;
  dataPoolType: 'SOURCE_TABLE' | 'QUERY_TABLE' | 'SINGLE_TABLE' | 'MULTI_TABLE' | string;
  dataPoolConfig: Record<string, unknown>;
  datasetCode: string;
  datasetName: string;
  tableName?: string;
  sourceSql?: string;
  createTableSql?: string;
  deletable?: boolean;
  modelCode: string;
  modelName: string;
  modelType: string;
  description?: string;
  modelConfig: Record<string, unknown>;
  fields: FieldMeta[];
}

export type DataPool = DatasetModel;

export interface SourceTable {
  tableName: string;
  tableNameCn?: string;
  fields: FieldMeta[];
}

export interface MetricSetting {
  fieldCode: string;
  displayName: string;
  aggType: string;
  chartType: ChartSeriesType;
  yAxis: 'left' | 'right';
  color: string;
  negativeColor?: string;
  smooth: boolean;
  layerIds: string[];
}

export interface FilterCondition {
  fieldCode: string;
  operator: 'eq' | 'gte' | 'lte' | 'in' | 'like';
  value: string;
  values?: string[];
}

export interface SortCondition {
  fieldCode: string;
  direction: 'asc' | 'desc';
}

export interface TableParamMap {
  [key: string]: string | number | boolean | null;
}

export interface QueryDsl {
  modelCode?: string;
  datasetCode?: string;
  dimensionField?: string;
  dimensionFields: string[];
  dimensions?: string[];
  seriesFields: string[];
  metrics: MetricSetting[];
  filters: FilterCondition[];
  orders: SortCondition[];
  sorters?: SortCondition[];
  params?: TableParamMap;
  limit: number;
}

export interface VisualDsl {
  title: string;
  subtitle: string;
  indicatorTag: string;
  xAxisName: string;
  leftAxisName: string;
  rightAxisName: string;
}

export interface StyleDsl {
  showSymbol: boolean;
  lineWidth: number;
  areaOpacity: number;
}

export interface InteractionDsl {
  tooltip: boolean;
  legend: boolean;
  dataZoom: boolean;
  slider: boolean;
}

export type StatisticalLineStyle = 'solid' | 'dashed' | 'dotted';
export type StatisticAxis = 'left' | 'right';

export interface DimensionConfigDsl {
  stackBySecondDimension: boolean;
  layerIds: string[];
}

export interface StatisticLineConfig {
  enabled: boolean;
  yAxis: StatisticAxis;
  lineColor: string;
  lineStyle: StatisticalLineStyle;
  layerIds: string[];
}

export interface StatisticBandConfig extends StatisticLineConfig {
  bandColor: string;
}

export type PercentileStatisticConfig = StatisticLineConfig;

export interface MetricStatisticScopeDsl {
  mean: StatisticLineConfig;
  std1: StatisticBandConfig;
  std2: StatisticBandConfig;
  percentile: PercentileStatisticConfig;
}

export interface ChartLayerDsl {
  id: string;
  layerName: string;
  enabled: boolean;
}

export interface StatisticalItemDsl {
  id: string;
  itemName: string;
  metricFieldCode?: string;
  rollingWindowYears?: number;
  visible: MetricStatisticScopeDsl;
  rolling: MetricStatisticScopeDsl;
}

export interface LayoutConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TableLayoutDsl {
  mode: 'list' | 'report';
  frozenLeftCount: number;
  frozenRightCount: number;
  headerRowCount: number;
  bodyRowCount: number;
  gridColumns: string[];
  gridRows: string[];
}

export interface TableStyleRule {
  fontWeight?: number;
  color?: string;
  backgroundColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface TableDesignerColumnDsl {
  id: string;
  fieldCode: string;
  title: string;
  role: 'dimension' | 'metric';
  width?: number;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  formatter?: 'text' | 'number' | 'percent';
  visible?: boolean;
  groupTitle?: string;
}

export interface TableHeaderGroupDsl {
  key: string;
  title: string;
  columnIds: string[];
}

export interface TableHeaderCellDsl {
  key: string;
  rowIndex: number;
  colIndex: number;
  title: string;
  colSpan?: number;
  rowSpan?: number;
}

export interface TableBodyCellDsl {
  key: string;
  rowIndex: number;
  colIndex: number;
  fieldCode: string;
  text?: string;
  value?: unknown;
  sourceText?: string;
  textOverride?: string;
}

export interface TableMergeDsl {
  key: string;
  region: 'header' | 'body';
  rowIndex: number;
  colIndex: number;
  rowSpan: number;
  colSpan: number;
}

export interface TableConditionalFormatDsl {
  key: string;
  fieldCode?: string;
  target?: 'body' | 'header' | 'all';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  value: number;
  style: TableStyleRule;
}

export interface TableTemplateDsl {
  rowFields: string[];
  columnFields: string[];
  valueFields: string[];
  threshold: number;
  gtColor: string;
  lteColor: string;
}

export interface TableWidgetDsl {
  key: string;
  fieldCode: string;
  widgetType: 'tag' | 'progress';
  options?: Record<string, unknown>;
}

export interface TableRegionStyleDsl {
  key: string;
  region: 'header' | 'body' | 'summary';
  style: TableStyleRule;
}

export interface TablePaginationDsl {
  enabled: boolean;
  pageSize: number;
}

export interface TableSummaryDsl {
  enabled: boolean;
  label?: string;
  metricFieldCodes: string[];
}

export interface TableDsl {
  template: TableTemplateDsl;
  rowHeaders?: string[];
  columnHeaders?: string[];
  columns: TableDesignerColumnDsl[];
  headerGroups: TableHeaderGroupDsl[];
  headerCells: TableHeaderCellDsl[];
  bodyCells: TableBodyCellDsl[];
  merges: TableMergeDsl[];
  styles: Record<string, TableStyleRule>;
  conditionalFormats: TableConditionalFormatDsl[];
  widgets: TableWidgetDsl[];
  regionStyles: TableRegionStyleDsl[];
  pagination: TablePaginationDsl;
  summary: TableSummaryDsl;
  rowNumber: boolean;
  striped: boolean;
  bordered: boolean;
  size: 'small' | 'middle' | 'large';
  rowSelection: boolean;
  emptyText: string;
}

export interface ComponentDslConfig {
  queryDsl: QueryDsl;
  dimensionConfigDsl: DimensionConfigDsl;
  visualDsl: VisualDsl;
  styleDsl: StyleDsl;
  interactionDsl: InteractionDsl;
  chartLayersDsl: ChartLayerDsl[];
  statisticalItemsDsl: StatisticalItemDsl[];
  layoutDsl?: TableLayoutDsl;
  tableDsl?: TableDsl;
  layout: LayoutConfig;
}

export interface DashboardComponent {
  componentCode: string;
  componentType: string;
  templateCode: string;
  modelCode: string;
  title: string;
  dslConfig: ComponentDslConfig;
}

export interface DashboardDraft {
  dashboardCode: string;
  name: string;
  status: string;
  publishedVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  components: DashboardComponent[];
}

export interface DashboardSummary {
  dashboardCode: string;
  name: string;
  status: string;
  publishedVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChartDefinition {
  chartCode: string;
  chartName: string;
  status: string;
  publishedVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  components: DashboardComponent[];
}

export interface ChartCatalogItem {
  chartCode: string;
  chartName: string;
  status: string;
  publishedVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PanelFieldSchema {
  type: 'text' | 'number' | 'switch' | 'model-select' | 'field-select' | 'field-multi-select' | 'metric-editor' | 'filter-editor' | 'sort-editor';
  scope: 'component' | 'dslConfig';
  path: string;
  label: string;
  description?: string;
  fieldRole?: 'dimension' | 'metric' | 'attribute';
  min?: number;
  max?: number;
  step?: number;
}

export interface PanelSectionSchema {
  key: string;
  title: string;
  description?: string;
  fields: PanelFieldSchema[];
}

export interface TemplateDefinition {
  templateCode: string;
  templateName: string;
  rendererCode: string;
  description?: string;
  capability?: {
    renderer?: 'cartesian_combo' | 'scatter_quadrant' | 'table' | 'pie' | string;
    chartTypes?: ChartSeriesType[];
    dimensionCount?: { min: number; max: number };
    metricCount?: { min: number; max: number };
    seriesFieldCount?: { min: number; max: number };
    supportsMultiTableModel?: boolean;
    description?: string;
  };
  panelSchema: {
    sections: PanelSectionSchema[];
  };
  defaultDsl: ComponentDslConfig;
}

export interface ChartPreview {
  modelCode: string;
  queryDsl: QueryDsl;
  generatedSql: string;
  rows: Record<string, unknown>[];
  dimensions: string[];
  metrics: string[];
  dslConfig: ComponentDslConfig;
}

export interface ChartLayerContext {
  activeLayerId?: string;
}

export interface RuntimeDashboardResponse {
  dashboardCode: string;
  versionNo: number;
  dashboard: DashboardDraft;
}

export interface RuntimeChartResponse {
  chartCode: string;
  versionNo: number;
  chart: ChartDefinition;
}

export interface FavoriteChart {
  favoriteId: string;
  dashboardCode: string;
  dashboardName: string;
  componentCode: string;
  componentTitle: string;
  templateCode: string;
  modelCode: string;
  dslConfig: ComponentDslConfig;
  addedAt: string;
}

export type DashboardCategoryKey = 'valuation' | 'liquidity' | 'sentiment' | 'cycle';

export interface DashboardMeta {
  dashboardCode: string;
  category: DashboardCategoryKey;
  order: number;
}

export interface PersonalBoard {
  boardId: string;
  boardName: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  components: FavoriteChart[];
}

export interface CreateDataPoolPayload {
  dataPoolCode: string;
  dataPoolName: string;
  dataPoolType: 'SOURCE_TABLE' | 'QUERY_TABLE';
  description?: string;
  sourceTable?: string;
  sourceAlias?: string;
  sqlText?: string;
  createTableSql?: string;
  dataPoolConfig?: Record<string, unknown>;
  fields?: Array<{
    fieldCode: string;
    fieldName: string;
    dataType: string;
    fieldRole: FieldMeta['fieldRole'];
    aggType?: string;
    sourceExpr: string;
  }>;
}

export interface CreateCalculatedMetricPayload {
  fieldCode: string;
  fieldName: string;
  baseFieldCode: string;
  calcType: 'avg' | 'sum' | 'max' | 'min' | 'rolling_3y_avg';
  aggType?: string;
}
