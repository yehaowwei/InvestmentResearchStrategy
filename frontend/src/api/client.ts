import axios from 'axios';
import type { ChartPreview, ComponentDslConfig, CreateCalculatedMetricPayload, CreateDataPoolPayload, DashboardDraft, DashboardSummary, DataPool, DatasetModel, FieldMeta, RuntimeDashboardResponse, SourceTable, TemplateDefinition } from '../types/dashboard';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

const client = axios.create({
  baseURL: 'http://localhost:8080/api'
});

client.interceptors.response.use(
  response => response,
  error => {
    const message = error?.response?.data?.message || error?.message || 'API request failed';
    return Promise.reject(new Error(message));
  }
);

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>) {
  const response = await promise;
  return response.data.data;
}

export const api = {
  listDashboards: () => unwrap<DashboardSummary[]>(client.get('/dashboard')),
  listDataPools: () => unwrap<DataPool[]>(client.get('/data-pool')),
  listModels: () => unwrap<DatasetModel[]>(client.get('/data-pool')),
  listSourceTables: () => unwrap<SourceTable[]>(client.get('/data-pool/source-tables')),
  createDataPool: (payload: CreateDataPoolPayload) => unwrap<DataPool>(client.post('/data-pool', payload)),
  previewDataPoolFields: (payload: CreateDataPoolPayload) => unwrap<FieldMeta[]>(client.post('/data-pool/preview-fields', payload)),
  updateDataPool: (dataPoolCode: string, payload: CreateDataPoolPayload) => unwrap<DataPool>(client.put(`/data-pool/${dataPoolCode}`, payload)),
  deleteDataPool: (dataPoolCode: string) => unwrap<boolean>(client.delete(`/data-pool/${dataPoolCode}`)),
  addCalculatedMetric: (dataPoolCode: string, payload: CreateCalculatedMetricPayload) =>
    unwrap<DataPool>(client.post(`/data-pool/${dataPoolCode}/calculated-metrics`, payload)),
  listTemplates: () => unwrap<TemplateDefinition[]>(client.get('/template')),
  loadDraft: (dashboardCode: string) => unwrap<DashboardDraft>(client.get(`/design/dashboard/${dashboardCode}`)),
  saveDraft: (draft: DashboardDraft) => unwrap<DashboardDraft>(client.post('/design/dashboard/save', { dashboardCode: draft.dashboardCode, draft })),
  deleteDashboard: (dashboardCode: string) => unwrap<boolean>(client.delete(`/design/dashboard/${dashboardCode}`)),
  publish: (dashboardCode: string) => unwrap<{ dashboardCode: string; versionNo: number }>(client.post('/design/dashboard/publish', { dashboardCode })),
  loadRuntime: (dashboardCode: string) => unwrap<RuntimeDashboardResponse>(client.post('/runtime/dashboard', [], { params: { dashboardCode } })),
  previewComponent: (component: { modelCode: string; dslConfig: ComponentDslConfig }) =>
    unwrap<ChartPreview>(client.post('/chart/preview', { modelCode: component.modelCode, dslConfig: component.dslConfig }))
};
