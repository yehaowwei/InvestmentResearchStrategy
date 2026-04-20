import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Spin, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ChartConfigPanel from '../components/ChartConfigPanel';
import DashboardCanvas from '../components/DashboardCanvas';
import type {
  ChartPreview,
  DashboardCategoryKey,
  DashboardComponent,
  DashboardDraft,
  DashboardSummary,
  DataPool,
  TemplateDefinition
} from '../types/dashboard';
import { createComponentFromTemplate, normalizeDashboard, normalizeDisplayText, resolveModel, syncTableComponentWithModel } from '../utils/dashboard';
import { DASHBOARD_CATEGORIES, ensureDashboardMeta, filterDashboardsByCategory, getDashboardMeta, normalizeCategoryKey, removeDashboardMeta } from '../utils/dashboardCatalog';

function canPreview(component: DashboardComponent) {
  const queryDsl = component.dslConfig.queryDsl;
  if (component.templateCode === 'table' || component.componentType === 'table') {
    return Boolean(component.modelCode && component.dslConfig.tableDsl?.template.columnFields?.length);
  }
  return Boolean(component.modelCode && queryDsl.dimensionFields?.length > 0 && queryDsl.metrics?.length > 0);
}

function createDashboardCode(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `dashboard_${Date.now()}`;
}

export default function DashboardDesigner() {
  const navigate = useNavigate();
  const params = useParams();
  const category = normalizeCategoryKey(params.categoryKey);
  const dashboardCode = params.dashboardCode;
  const [form] = Form.useForm<{ name: string; dashboardCode: string; category: DashboardCategoryKey; order: number }>();
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [dataPools, setDataPools] = useState<DataPool[]>([]);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [draft, setDraft] = useState<DashboardDraft>();
  const [selectedComponentCode, setSelectedComponentCode] = useState<string>();
  const [previews, setPreviews] = useState<Record<string, ChartPreview>>({});
  const [initializing, setInitializing] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const loading = initializing || loadingDraft;
  const categoryDashboards = useMemo(() => filterDashboardsByCategory(dashboards, category), [dashboards, category]);
  const selectedComponent = draft?.components.find(component => component.componentCode === selectedComponentCode);
  const currentMeta = draft ? getDashboardMeta(draft.dashboardCode) : undefined;

  useEffect(() => {
    Promise.all([api.listDashboards(), api.listDataPools(), api.listTemplates()])
      .then(([nextDashboards, nextDataPools, nextTemplates]) => {
        setDashboards(nextDashboards);
        setDataPools(nextDataPools);
        setTemplates(nextTemplates);
      })
      .catch(error => message.error(error instanceof Error ? error.message : '指标配置初始化失败'))
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    if (initializing) {
      return;
    }

    if (!dashboardCode) {
      const first = filterDashboardsByCategory(dashboards, category)[0];
      if (first) {
        navigate(`/designer/${category}/${first.dashboardCode}`, { replace: true });
        return;
      }
      setDraft(undefined);
      setSelectedComponentCode(undefined);
      setPreviews({});
      return;
    }

    setLoadingDraft(true);
    api.loadDraft(dashboardCode)
      .then(async nextDraft => {
        const normalized = normalizeDashboard(nextDraft);
        ensureDashboardMeta(normalized.dashboardCode);
        setDraft(normalized);
        setSelectedComponentCode(normalized.components[0]?.componentCode);
        const previewPairs = await Promise.all(
          normalized.components
            .filter(canPreview)
            .map(async component => [component.componentCode, await api.previewComponent(component)] as const)
        );
        setPreviews(Object.fromEntries(previewPairs));
      })
      .catch(error => message.error(error instanceof Error ? error.message : '指标配置加载失败'))
      .finally(() => setLoadingDraft(false));
  }, [initializing, dashboards, dashboardCode, category, navigate]);

  const refreshDashboards = async () => {
    const nextDashboards = await api.listDashboards();
    setDashboards(nextDashboards);
    return nextDashboards;
  };

  const applyDraftComponent = (component: DashboardComponent) => {
    setDraft(state => state ? {
      ...state,
      components: state.components.map(item => item.componentCode === component.componentCode ? component : item)
    } : state);
  };

  const previewComponent = async (component: DashboardComponent) => {
    if (!canPreview(component)) {
      setPreviews(state => {
        const next = { ...state };
        delete next[component.componentCode];
        return next;
      });
      return;
    }

    const preview = await api.previewComponent(component);
    if (component.templateCode === 'table' || component.componentType === 'table') {
      const syncedComponent = syncTableComponentWithModel(
        component,
        resolveModel(dataPools, component.modelCode),
        preview.rows
      );
      applyDraftComponent(syncedComponent);
    }
    setPreviews(state => ({ ...state, [component.componentCode]: preview }));
  };

  const updateComponent = async (component: DashboardComponent) => {
    applyDraftComponent(component);
    await previewComponent(component);
  };

  const addComponent = () => {
    if (!draft || templates.length === 0 || dataPools.length === 0) {
      return;
    }

    const defaultTemplate = templates.find(item => (item.capability?.renderer ?? item.rendererCode) === 'cartesian_combo') ?? templates[0];
    const component = createComponentFromTemplate(defaultTemplate, dataPools[0].dataPoolCode, draft.components.length);
    setDraft({
      ...draft,
      components: [...draft.components, component]
    });
    setSelectedComponentCode(component.componentCode);
  };

  const saveDraft = async () => {
    if (!draft) {
      return;
    }

    const saved = await api.saveDraft(draft);
    const normalized = normalizeDashboard(saved);
    setDraft(normalized);
    setSelectedComponentCode(current => current ?? normalized.components[0]?.componentCode);
    await refreshDashboards();
    return normalized;
  };

  const createDashboard = async () => {
    const values = await form.validateFields();
    if (templates.length === 0 || dataPools.length === 0) {
      message.warning('当前缺少模板或数据池，无法新建看板');
      return;
    }

    const nextCode = values.dashboardCode.trim() || createDashboardCode(values.name);
    if (dashboards.some(item => item.dashboardCode === nextCode)) {
      message.error('看板编码已存在，请更换一个');
      return;
    }

    setCreating(true);
    try {
      const template = templates.find(item => (item.capability?.renderer ?? item.rendererCode) === 'cartesian_combo') ?? templates[0];
      const component = createComponentFromTemplate(template, dataPools[0].dataPoolCode, 0);
      const nextDraft: DashboardDraft = {
        dashboardCode: nextCode,
        name: values.name.trim(),
        status: 'DRAFT',
        publishedVersion: 0,
        components: [component]
      };

      await api.saveDraft(nextDraft);
      ensureDashboardMeta(nextCode, {
        category: values.category,
        order: Number(values.order ?? 0)
      });
      await refreshDashboards();
      setCreateOpen(false);
      form.resetFields();
      message.success('新看板已创建');
      navigate(`/designer/${values.category}/${nextCode}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新建看板失败');
    } finally {
      setCreating(false);
    }
  };

  const updateDashboardMeta = (patch: Partial<{ category: DashboardCategoryKey; order: number }>) => {
    if (!draft) {
      return;
    }
    const nextMeta = ensureDashboardMeta(draft.dashboardCode, patch);
    setDashboards(state => [...state]);
    if (patch.category && patch.category !== category) {
      navigate(`/designer/${nextMeta.category}/${draft.dashboardCode}`);
    }
  };

  const openCreateModal = () => {
    form.setFieldsValue({ name: '', dashboardCode: '', category, order: categoryDashboards.length + 1 });
    setCreateOpen(true);
  };

  const actions = (
    <Space size={12} wrap={false}>
      <Select
        style={{ width: 180 }}
        value={category}
        options={DASHBOARD_CATEGORIES.map(item => ({ label: item.label, value: item.key }))}
        onChange={value => navigate(`/designer/${value}`)}
      />
      <Select
        style={{ minWidth: 260 }}
        value={draft?.dashboardCode}
        placeholder="切换看板"
        options={categoryDashboards.map(item => ({
          label: normalizeDisplayText(item.name, item.dashboardCode),
          value: item.dashboardCode
        }))}
        onChange={value => navigate(`/designer/${category}/${value}`)}
      />
      <Input
        style={{ width: 240 }}
        value={draft?.name ?? ''}
        placeholder="看板名称"
        disabled={!draft}
        onChange={event => {
          const value = event.target.value;
          setDraft(state => state ? { ...state, name: value } : state);
        }}
      />
      <InputNumber
        style={{ width: 140 }}
        value={draft ? currentMeta?.order ?? 0 : categoryDashboards.length + 1}
        min={0}
        addonBefore="排序"
        disabled={!draft}
        onChange={value => updateDashboardMeta({ order: Number(value ?? 0) })}
      />
      <Button icon={<PlusOutlined />} onClick={openCreateModal}>
        新建看板
      </Button>
      <Button type="primary" onClick={addComponent} disabled={!draft}>新增组件</Button>
      <Button
        onClick={async () => {
          try {
            await saveDraft();
            message.success('草稿已保存');
          } catch (error) {
            message.error(error instanceof Error ? error.message : '保存草稿失败');
          }
        }}
        disabled={!draft}
      >
        保存草稿
      </Button>
      <Button
        type="primary"
        onClick={async () => {
          try {
            const normalized = await saveDraft();
            if (!normalized) {
              return;
            }
            const result = await api.publish(normalized.dashboardCode);
            setDraft({ ...normalized, publishedVersion: result.versionNo, status: 'PUBLISHED' });
            await refreshDashboards();
            message.success(`已发布到版本 ${result.versionNo}`);
          } catch (error) {
            message.error(error instanceof Error ? error.message : '发布失败');
          }
        }}
        disabled={!draft}
      >
        发布
      </Button>
      <Popconfirm
        title="确认删除当前看板吗？"
        okText="确认删除"
        cancelText="取消"
        onConfirm={async () => {
          if (!draft) {
            return;
          }
          try {
            await api.deleteDashboard(draft.dashboardCode);
            removeDashboardMeta(draft.dashboardCode);
            const nextDashboards = await refreshDashboards();
            message.success('看板已删除');
            const nextTarget = filterDashboardsByCategory(nextDashboards, category)[0];
            if (nextTarget) {
              navigate(`/designer/${category}/${nextTarget.dashboardCode}`);
              return;
            }
            setDraft(undefined);
            setSelectedComponentCode(undefined);
            setPreviews({});
            navigate(`/designer/${category}`);
          } catch (error) {
            message.error(error instanceof Error ? error.message : '删除看板失败');
          }
        }}
      >
        <Button danger icon={<DeleteOutlined />} disabled={!draft}>删除看板</Button>
      </Popconfirm>
    </Space>
  );

  const emptyCanvas = (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>当前分类还没有看板</div>
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
        新建看板
      </Button>
    </div>
  );

  if (loading) {
    return <Spin />;
  }

  return (
    <>
      <div className="page-header">
        <Space wrap size={12}>
          {actions}
        </Space>
        <div>
          <h2 className="page-title">{draft ? normalizeDisplayText(draft.name, draft.dashboardCode) : '指标配置'}</h2>
        </div>
      </div>

      <div className="page-shell">
        <DashboardCanvas
          components={draft?.components ?? []}
          previews={previews}
          editable={Boolean(draft)}
          dataPools={dataPools}
          selectedComponentCode={selectedComponentCode}
          onSelect={setSelectedComponentCode}
          onLayoutChange={components => setDraft(state => state ? { ...state, components } : state)}
          onComponentChange={applyDraftComponent}
          onComponentPreview={component => {
            void previewComponent(component);
          }}
          emptyContent={emptyCanvas}
          renderActions={component => (
            <Popconfirm
              title="确认删除当前组件吗？"
              okText="确认删除"
              cancelText="取消"
              onConfirm={() => {
                setDraft(state => state ? {
                  ...state,
                  components: state.components.filter(item => item.componentCode !== component.componentCode)
                } : state);
                setSelectedComponentCode(state => state === component.componentCode
                  ? draft?.components.find(item => item.componentCode !== component.componentCode)?.componentCode
                  : state);
                setPreviews(state => {
                  const next = { ...state };
                  delete next[component.componentCode];
                  return next;
                });
              }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        />

        <ChartConfigPanel
          component={selectedComponent}
          dataPools={dataPools}
          templates={templates}
          preview={selectedComponent ? previews[selectedComponent.componentCode] : undefined}
          onChange={component => {
            void updateComponent(component);
          }}
          onPreview={() => selectedComponent && void previewComponent(selectedComponent)}
        />
      </div>

      <Modal
        title="新建看板"
        open={createOpen}
        onOk={() => void createDashboard()}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="看板名称" rules={[{ required: true, message: '请输入看板名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="dashboardCode" label="看板编码">
            <Input />
          </Form.Item>
          <Form.Item name="category" label="看板分类" rules={[{ required: true, message: '请选择看板分类' }]}>
            <Select options={DASHBOARD_CATEGORIES.map(item => ({ label: item.label, value: item.key }))} />
          </Form.Item>
          <Form.Item name="order" label="排序" initialValue={1}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
