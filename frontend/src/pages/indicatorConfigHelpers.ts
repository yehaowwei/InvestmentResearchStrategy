import { api } from '../api/client';
import type { ChartPreview, DashboardComponent } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import { normalizeChartDefinition } from '../utils/chartDefinition';

export interface LibraryPreviewItem {
  component: DashboardComponent;
  preview: ChartPreview;
}

export function canPreview(component: DashboardComponent) {
  const queryDsl = component.dslConfig.queryDsl;
  if (component.templateCode === 'table' || component.componentType === 'table') {
    return Boolean(component.modelCode && component.dslConfig.tableDsl?.template.columnFields?.length);
  }
  return Boolean(component.modelCode && queryDsl.dimensionFields?.length > 0 && queryDsl.metrics?.length > 0);
}

export function formatDateTime(value?: string) {
  if (!value) return '未记录';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return value;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

export function resolveComponentChartName(component?: DashboardComponent, fallback?: string) {
  if (!component) return normalizeDisplayText(fallback, '');
  return normalizeDisplayText(
    component.dslConfig.visualDsl.title || component.title,
    fallback || component.componentCode
  );
}

export async function loadLibraryPreview(chartCode: string) {
  const draft = normalizeChartDefinition(await api.loadChartDraft(chartCode));
  const component = draft.components[0];
  if (!component || !canPreview(component)) {
    return undefined;
  }
  const preview = await api.previewComponent(component);
  return { component, preview } satisfies LibraryPreviewItem;
}
