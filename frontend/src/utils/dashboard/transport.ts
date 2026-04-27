import type { DashboardComponent, DashboardDraft, DatasetModel } from '../../types/dashboard';
import { resolveModel, normalizeDisplayText } from '../dashboardText';
import { normalizeDslConfig } from './normalization';

export function normalizeComponentForTransport(
  component: DashboardComponent,
  model?: DatasetModel
): DashboardComponent {
  const normalizedDsl = normalizeDslConfig(component.dslConfig, model);
  const normalizedModelCode = component.modelCode || normalizedDsl.queryDsl.modelCode || '';
  return {
    ...component,
    modelCode: normalizedModelCode,
    title: normalizeDisplayText(component.title, component.componentCode),
    dslConfig: {
      ...normalizedDsl,
      queryDsl: {
        ...normalizedDsl.queryDsl,
        modelCode: normalizedModelCode
      },
      visualDsl: {
        ...normalizedDsl.visualDsl,
        title: normalizeDisplayText(normalizedDsl.visualDsl.title, component.title || component.componentCode)
      }
    }
  };
}

export function normalizeDashboardForTransport(
  draft: DashboardDraft,
  models: DatasetModel[] = []
): DashboardDraft {
  return {
    ...draft,
    name: normalizeDisplayText(draft.name, draft.dashboardCode),
    components: draft.components.map(component =>
      normalizeComponentForTransport(component, resolveModel(models, component.modelCode))
    )
  };
}
