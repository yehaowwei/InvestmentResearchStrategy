import type { DashboardComponent, DatasetModel, TemplateDefinition } from '../../types/dashboard';
import {
  buildInitialTableDsl,
  buildTableColumnsFromQuery,
  normalizeTableDsl,
  normalizeTableLayoutDsl,
  syncTableComponentWithModel as syncTableComponentWithModelBase
} from '../dashboardTable';
import {
  deepClone,
  getDefaultTableColumnFields,
  isSelectableTableField,
  normalizeDisplayText,
  resolveModel
} from '../dashboardText';
import { createChartLayer } from './chartLayers';
import { normalizeDslConfig } from './normalization';

export {
  buildInitialTableDsl,
  buildTableColumnsFromQuery,
  normalizeTableDsl,
  normalizeTableLayoutDsl
} from '../dashboardTable';

export {
  deepClone,
  getDefaultTableColumnFields,
  isSelectableTableField,
  normalizeDisplayText,
  resolveModel
} from '../dashboardText';

export function createComponentFromTemplate(template: TemplateDefinition, modelCode: string, index: number): DashboardComponent {
  const dslConfig = normalizeDslConfig(deepClone(template.defaultDsl));
  const firstLayerId = dslConfig.chartLayersDsl[0]?.id || createChartLayer(0).id;
  const isTable = template.templateCode === 'table' || template.rendererCode === 'table' || template.capability?.renderer === 'table';
  dslConfig.queryDsl = {
    ...dslConfig.queryDsl,
    modelCode,
    dimensionFields: [],
    seriesFields: [],
    metrics: [],
    filters: [],
    orders: [],
    params: {}
  };
  dslConfig.dimensionConfigDsl = {
    ...dslConfig.dimensionConfigDsl,
    layerIds: [firstLayerId]
  };
  dslConfig.statisticalItemsDsl = [];
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

export function syncTableComponentWithModel(
  component: DashboardComponent,
  model?: DatasetModel,
  previewRows: Record<string, unknown>[] = []
) {
  return syncTableComponentWithModelBase(component, normalizeDslConfig, model, previewRows);
}
