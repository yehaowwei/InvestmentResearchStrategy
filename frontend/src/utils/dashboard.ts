export {
  buildInitialTableDsl,
  buildTableColumnsFromQuery,
  deepClone,
  getDefaultTableColumnFields,
  isSelectableTableField,
  normalizeDisplayText,
  normalizeTableDsl,
  normalizeTableLayoutDsl,
  resolveModel,
  createComponentFromTemplate,
  syncTableComponentWithModel
} from './dashboard/componentFactory';

export { createChartLayer } from './dashboard/chartLayers';

export {
  createStatisticItem,
  ensureFilterDefaults,
  ensureMetricDefaults,
  ensureSortDefaults,
  normalizeStatisticItemName
} from './dashboard/statistics';

export { normalizeDslConfig, normalizeDashboard } from './dashboard/normalization';

export { normalizeComponentForTransport, normalizeDashboardForTransport } from './dashboard/transport';
