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
  ExternalResourceGroup,
  FieldMeta,
  RuntimeChartResponse,
  RuntimeDashboardResponse,
  SourceTable,
  StrategyAiChatResponse,
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

function buildPreviewPayload(component: {
  modelCode: string;
  dslConfig: ComponentDslConfig;
  componentCode?: string;
  componentType?: string;
  templateCode?: string;
  title?: string;
}) {
  const normalizedComponent = normalizeComponentForTransport({
    componentCode: component.componentCode || 'preview-component',
    componentType: component.componentType || (component.templateCode === 'table' ? 'table' : 'chart'),
    templateCode: component.templateCode || 'line',
    modelCode: component.modelCode,
    title: component.title || component.dslConfig.visualDsl?.title || '预览指标',
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
  strategyAiChat: (payload: {
    strategyName: string;
    prompt: string;
    charts: Array<{ title: string; summary: string; meaning: string }>;
  }) => unwrap<StrategyAiChatResponse>(client.post('/strategy-ai/chat', payload)),
  strategyAiChatStream: async (
    payload: {
      strategyName: string;
      prompt: string;
      charts: Array<{ title: string; summary: string; meaning: string }>;
    },
    onChunk: (chunk: string) => void
  ) => {
    const response = await fetch('/api/strategy-ai/chat-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(errorText || 'AI stream request failed');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) {
        continue;
      }
      fullText += chunk;
      onChunk(chunk);
    }

    const tail = decoder.decode();
    if (tail) {
      fullText += tail;
      onChunk(tail);
    }

    return fullText;
  },
  getSharedState: (stateKey: string) =>
    unwrap<unknown>(client.get(`/shared-state/${encodeURIComponent(stateKey)}`)),
  saveSharedState: (stateKey: string, state: unknown) =>
    unwrap<unknown>(client.put(`/shared-state/${encodeURIComponent(stateKey)}`, { state })),
  listExternalResourceGroups: () =>
    unwrap<ExternalResourceGroup[]>(client.get('/external-resource/group')),
  listExternalResourceDirectories: () =>
    unwrap<Array<{ label: string; value: string }>>(client.get('/external-resource/directories')),
  getExternalResourceGroupBySlug: (slug: string) =>
    unwrap<ExternalResourceGroup>(client.get(`/external-resource/group/slug/${encodeURIComponent(slug)}`)),
  createExternalResourceGroup: (payload: { name: string; slug?: string; parentName?: string }) =>
    unwrap<ExternalResourceGroup>(client.post('/external-resource/group', payload)),
  updateExternalResourceGroup: (groupId: string, payload: { name: string; slug?: string; parentName?: string }) =>
    unwrap<ExternalResourceGroup>(client.put(`/external-resource/group/${encodeURIComponent(groupId)}`, payload)),
  createExternalResourceThirdLevel: (groupId: string, name: string) =>
    unwrap<ExternalResourceGroup>(client.post(`/external-resource/group/${encodeURIComponent(groupId)}/third-level`, { name })),
  uploadExternalResourceFiles: async (
    groupId: string,
    files: File[],
    metadata?: { resourceName?: string; sectionName?: string; thirdLevelName?: string }
  ) => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    if (metadata?.resourceName) {
      formData.append('resourceName', metadata.resourceName);
    }
    if (metadata?.sectionName) {
      formData.append('sectionName', metadata.sectionName);
    }
    if (metadata?.thirdLevelName) {
      formData.append('thirdLevelName', metadata.thirdLevelName);
    }
    return unwrap<ExternalResourceGroup>(client.post(`/external-resource/group/${encodeURIComponent(groupId)}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }));
  },
  createExternalResourceLink: (groupId: string, payload: {
    title: string;
    href: string;
    sectionName?: string;
    thirdLevelName?: string;
    resourceType?: string;
  }) =>
    unwrap<ExternalResourceGroup>(client.post(`/external-resource/group/${encodeURIComponent(groupId)}/resources`, payload)),
  updateExternalResource: (groupId: string, fileId: string, payload: {
    title: string;
    href?: string;
    sectionName?: string;
    thirdLevelName?: string;
    resourceType?: string;
  }) =>
    unwrap<ExternalResourceGroup>(client.put(`/external-resource/group/${encodeURIComponent(groupId)}/resources/${encodeURIComponent(fileId)}`, payload)),
  reorderExternalResourceFiles: (groupId: string, fileIds: string[]) =>
    unwrap<ExternalResourceGroup>(client.put(`/external-resource/group/${encodeURIComponent(groupId)}/file-order`, { fileIds })),
  deleteExternalResourceFile: (groupId: string, fileId: string) =>
    unwrap<boolean>(client.delete(`/external-resource/group/${encodeURIComponent(groupId)}/files/${encodeURIComponent(fileId)}`)),
  deleteExternalResourceGroup: (groupId: string) =>
    unwrap<boolean>(client.delete(`/external-resource/group/${encodeURIComponent(groupId)}`))
};
