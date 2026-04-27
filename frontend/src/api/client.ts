import axios from 'axios';
import type {
  ChartCatalogItem,
  ChartDefinition,
  ChartPreview,
  ComponentDslConfig,
  CreateCalculatedMetricPayload,
  CreateDataPoolPayload,
  DashboardDraft,
  DashboardSummary,
  DataPool,
  DatasetModel,
  FieldMeta,
  RuntimeChartResponse,
  RuntimeDashboardResponse,
  SourceTable,
  TkfAgentMessage,
  TkfAgentResponse,
  TkfChartCandidate,
  TemplateDefinition
} from '../types/dashboard';
import { normalizeComponentForTransport, normalizeDashboardForTransport } from '../utils/dashboard';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

const client = axios.create({
  baseURL: '/api'
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

function toChartCatalogItem(item: DashboardSummary): ChartCatalogItem {
  return {
    chartCode: item.dashboardCode,
    chartName: item.name,
    status: item.status,
    publishedVersion: item.publishedVersion,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function toChartDefinition(draft: DashboardDraft): ChartDefinition {
  return {
    chartCode: draft.dashboardCode,
    chartName: draft.name,
    status: draft.status,
    publishedVersion: draft.publishedVersion,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    components: draft.components
  };
}

function toRuntimeChartResponse(runtime: RuntimeDashboardResponse): RuntimeChartResponse {
  return {
    chartCode: runtime.dashboardCode,
    versionNo: runtime.versionNo,
    chart: toChartDefinition(runtime.dashboard)
  };
}

function buildChartDraftPayload(chart: ChartDefinition): DashboardDraft {
  return normalizeDashboardForTransport({
    dashboardCode: chart.chartCode || undefined,
    name: chart.chartName,
    status: chart.status,
    publishedVersion: chart.publishedVersion,
    components: chart.components
  } as DashboardDraft);
}

function buildPreviewPayload(component: { modelCode: string; dslConfig: ComponentDslConfig }) {
  const normalizedComponent = normalizeComponentForTransport({
    componentCode: 'preview-component',
    componentType: 'chart',
    templateCode: 'line',
    modelCode: component.modelCode,
    title: component.dslConfig.visualDsl?.title || '预览图表',
    dslConfig: component.dslConfig
  });
  return {
    modelCode: normalizedComponent.modelCode,
    dslConfig: normalizedComponent.dslConfig
  };
}

export const api = {
  listDashboards: () => unwrap<DashboardSummary[]>(client.get('/dashboard')),
  listCharts: async () => (await unwrap<DashboardSummary[]>(client.get('/dashboard'))).map(toChartCatalogItem),
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
  loadChartDraft: async (chartCode: string) => toChartDefinition(await unwrap<DashboardDraft>(client.get(`/design/dashboard/${chartCode}`))),
  saveDraft: (draft: DashboardDraft) => {
    const normalizedDraft = normalizeDashboardForTransport(draft);
    return unwrap<DashboardDraft>(client.post('/design/dashboard/save', {
      dashboardCode: normalizedDraft.dashboardCode,
      draft: normalizedDraft
    }));
  },
  saveChartDraft: async (chart: ChartDefinition) => {
    const normalizedDraft = buildChartDraftPayload(chart);
    return toChartDefinition(await unwrap<DashboardDraft>(client.post('/design/dashboard/save', {
      dashboardCode: chart.chartCode || undefined,
      draft: normalizedDraft
    })));
  },
  deleteDashboard: (dashboardCode: string) => unwrap<boolean>(client.delete(`/design/dashboard/${dashboardCode}`)),
  deleteChartDraft: (chartCode: string) => unwrap<boolean>(client.delete(`/design/dashboard/${chartCode}`)),
  publish: (dashboardCode: string) => unwrap<{ dashboardCode: string; versionNo: number }>(client.post('/design/dashboard/publish', { dashboardCode })),
  publishChart: async (chartCode: string) => {
    const result = await unwrap<{ dashboardCode: string; versionNo: number }>(client.post('/design/dashboard/publish', { dashboardCode: chartCode }));
    return { chartCode: result.dashboardCode, versionNo: result.versionNo };
  },
  loadRuntime: (dashboardCode: string) => unwrap<RuntimeDashboardResponse>(client.post('/runtime/dashboard', [], { params: { dashboardCode } })),
  loadRuntimeChart: async (chartCode: string) => toRuntimeChartResponse(await unwrap<RuntimeDashboardResponse>(client.post('/runtime/dashboard', [], { params: { dashboardCode: chartCode } }))),
  previewComponent: (component: { modelCode: string; dslConfig: ComponentDslConfig }) =>
    unwrap<ChartPreview>(client.post('/chart/preview', buildPreviewPayload(component))),
  getSharedState: (stateKey: string) =>
    unwrap<unknown>(client.get(`/shared-state/${encodeURIComponent(stateKey)}`)),
  saveSharedState: (stateKey: string, state: unknown) =>
    unwrap<unknown>(client.put(`/shared-state/${encodeURIComponent(stateKey)}`, { state })),
  tkfAgentChat: (payload: { messages: TkfAgentMessage[]; availableCharts: TkfChartCandidate[] }) =>
    unwrap<TkfAgentResponse>(client.post('/agent/tkf/chat', payload))
};
