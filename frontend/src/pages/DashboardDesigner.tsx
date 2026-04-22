import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ChartConfigPanel from '../components/ChartConfigPanel';
import ChartRendererCore from '../components/ChartRendererCore';
import DashboardCanvas from '../components/DashboardCanvas';
import type {
  ChartCatalogItem,
  ChartDefinition,
  ChartPreview,
  DashboardCategoryKey,
  DashboardComponent,
  DataPool,
  TemplateDefinition
} from '../types/dashboard';
import {
  createComponentFromTemplate,
  normalizeDashboard,
  normalizeDisplayText,
  resolveModel,
  syncTableComponentWithModel
} from '../utils/dashboard';
import { getChartDraftMeta, removeChartDraftMeta, updateChartDraftMeta } from '../utils/chartDraftMeta';
import {
  DASHBOARD_CATEGORIES,
  ensureDashboardMeta,
  filterChartsByCategory,
  getCategoryLabel,
  getDashboardMeta,
  normalizeCategoryKey,
  removeDashboardMeta
} from '../utils/dashboardCatalog';

type SortMode = 'manual' | 'time_asc' | 'time_desc';

interface LibraryPreviewItem {
  component: DashboardComponent;
  preview: ChartPreview;
}

function reorderItemsPreview<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function parseSortTime(value?: string) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function normalizeSearchKeyword(value: string) {
  return value.trim().toLowerCase();
}

function canPreview(component: DashboardComponent) {
  const queryDsl = component.dslConfig.queryDsl;
  if (component.templateCode === 'table' || component.componentType === 'table') {
    return Boolean(component.modelCode && component.dslConfig.tableDsl?.template.columnFields?.length);
  }
  return Boolean(component.modelCode && queryDsl.dimensionFields?.length > 0 && queryDsl.metrics?.length > 0);
}

function normalizeChartDefinition(chart: ChartDefinition) {
  const normalized = normalizeDashboard({
    dashboardCode: chart.chartCode,
    name: chart.chartName,
    status: chart.status,
    publishedVersion: chart.publishedVersion,
    components: chart.components
  });
  const primaryComponent = normalized.components[0];
  return {
    chartCode: normalized.dashboardCode,
    chartName: normalized.name,
    status: normalized.status,
    publishedVersion: normalized.publishedVersion,
    createdAt: chart.createdAt,
    updatedAt: chart.updatedAt,
    components: primaryComponent ? [primaryComponent] : []
  } satisfies ChartDefinition;
}

function formatDateTime(value?: string) {
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

function resolveComponentChartName(component?: DashboardComponent, fallback?: string) {
  if (!component) return normalizeDisplayText(fallback, '');
  return normalizeDisplayText(
    component.dslConfig.visualDsl.title || component.title,
    fallback || component.componentCode
  );
}

async function loadLibraryPreview(chartCode: string) {
  const draft = normalizeChartDefinition(await api.loadChartDraft(chartCode));
  const component = draft.components[0];
  if (!component || !canPreview(component)) {
    return undefined;
  }
  const preview = await api.previewComponent(component);
  return { component, preview } satisfies LibraryPreviewItem;
}

export default function DashboardDesigner() {
  const navigate = useNavigate();
  const params = useParams();
  const routeCategory = normalizeCategoryKey(params.categoryKey);
  const chartCode = params.chartCode;
  const [form] = Form.useForm<{ name: string; category: DashboardCategoryKey }>();
  const [charts, setCharts] = useState<ChartCatalogItem[]>([]);
  const [dataPools, setDataPools] = useState<DataPool[]>([]);
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [draft, setDraft] = useState<ChartDefinition>();
  const [draftPreview, setDraftPreview] = useState<ChartPreview>();
  const [publishedSnapshot, setPublishedSnapshot] = useState<string>();
  const [libraryPreviewMap, setLibraryPreviewMap] = useState<Record<string, LibraryPreviewItem>>({});
  const [initializing, setInitializing] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [draggingChartCode, setDraggingChartCode] = useState<string>();
  const [dragOverChartCode, setDragOverChartCode] = useState<string>();
  const [activeChartCodes, setActiveChartCodes] = useState<string[]>([]);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  const isEditMode = Boolean(chartCode);
  const selectedChart = draft?.components[0];
  const currentMeta = draft ? getDashboardMeta(draft.chartCode) : undefined;
  const selectedDraftMeta = draft ? getChartDraftMeta(draft.chartCode) : undefined;
  const draftSnapshot = useMemo(
    () => (draft ? JSON.stringify({ chartName: draft.chartName, components: draft.components }) : undefined),
    [draft]
  );
  const isDraftPublished = Boolean(draft && publishedSnapshot && draftSnapshot === publishedSnapshot);

  const libraryCharts = useMemo(() => {
    const keyword = normalizeSearchKeyword(searchKeyword);
    const next = filterChartsByCategory(charts, routeCategory, false).filter(item => {
      if (!keyword) {
        return true;
      }
      return [
        normalizeDisplayText(item.chartName, item.chartCode),
        item.chartCode
      ].some(value => value.toLowerCase().includes(keyword));
    });
    if (sortMode === 'manual') {
      return next;
    }
    return [...next].sort((a, b) => {
      const compare = parseSortTime(a.updatedAt ?? a.createdAt) - parseSortTime(b.updatedAt ?? b.createdAt);
      if (compare !== 0) {
        return sortMode === 'time_asc' ? compare : -compare;
      }
      return normalizeDisplayText(a.chartName, a.chartCode).localeCompare(normalizeDisplayText(b.chartName, b.chartCode));
    });
  }, [charts, routeCategory, searchKeyword, sortMode]);

  const renderedLibraryCharts = useMemo(() => {
    if (!draggingChartCode || !dragOverChartCode || sortMode !== 'manual') {
      return libraryCharts;
    }
    const fromIndex = libraryCharts.findIndex(item => item.chartCode === draggingChartCode);
    const toIndex = libraryCharts.findIndex(item => item.chartCode === dragOverChartCode);
    return reorderItemsPreview(libraryCharts, fromIndex, toIndex);
  }, [dragOverChartCode, draggingChartCode, libraryCharts, sortMode]);

  const livePreviewKey = useMemo(() => {
    if (!selectedChart || selectedChart.templateCode === 'table' || selectedChart.componentType === 'table') {
      return '';
    }
    return JSON.stringify({
      componentCode: selectedChart.componentCode,
      templateCode: selectedChart.templateCode,
      modelCode: selectedChart.modelCode,
      queryDsl: selectedChart.dslConfig.queryDsl,
      visualDsl: selectedChart.dslConfig.visualDsl,
      chartLayersDsl: selectedChart.dslConfig.chartLayersDsl,
      dimensionConfigDsl: selectedChart.dslConfig.dimensionConfigDsl,
      statisticalItemsDsl: selectedChart.dslConfig.statisticalItemsDsl
    });
  }, [selectedChart]);

  const tablePreviewKey = useMemo(() => {
    if (!selectedChart || (selectedChart.templateCode !== 'table' && selectedChart.componentType !== 'table')) {
      return '';
    }
    return JSON.stringify({
      componentCode: selectedChart.componentCode,
      modelCode: selectedChart.modelCode,
      templateCode: selectedChart.templateCode,
      queryDsl: selectedChart.dslConfig.queryDsl,
      tableTemplate: selectedChart.dslConfig.tableDsl?.template
    });
  }, [selectedChart]);

  useEffect(() => {
    Promise.all([api.listCharts(), api.listDataPools(), api.listTemplates()])
      .then(([nextCharts, nextDataPools, nextTemplates]) => {
        setCharts(nextCharts);
        setDataPools(nextDataPools);
        setTemplates(nextTemplates);
      })
      .catch(error => {
        message.error(error instanceof Error ? error.message : '指标配置初始化失败');
      })
      .finally(() => setInitializing(false));
  }, []);

  useEffect(() => {
    setActiveChartCodes(renderedLibraryCharts.slice(0, 3).map(item => item.chartCode));
  }, [renderedLibraryCharts]);

  useEffect(() => {
    if (initializing || isEditMode) {
      return;
    }
    if (libraryCharts.length === 0) {
      setLibraryPreviewMap({});
      return;
    }

    let cancelled = false;
    setLoadingLibrary(true);
    Promise.all(
      libraryCharts.map(async item => {
        try {
          const previewItem = await loadLibraryPreview(item.chartCode);
          return previewItem ? [item.chartCode, previewItem] as const : undefined;
        } catch {
          return undefined;
        }
      })
    )
      .then(entries => {
        if (cancelled) return;
        const nextMap: Record<string, LibraryPreviewItem> = {};
        entries.forEach(entry => {
          if (entry) nextMap[entry[0]] = entry[1];
        });
        setLibraryPreviewMap(nextMap);
      })
      .finally(() => {
        if (!cancelled) setLoadingLibrary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initializing, isEditMode, libraryCharts]);

  useEffect(() => {
    if (isEditMode || renderedLibraryCharts.length === 0) {
      return;
    }
    const updateActiveCharts = () => {
      const cards = renderedLibraryCharts
        .map(item => {
          const element = document.getElementById(`designer-chart-card-${item.chartCode}`);
          if (!element) return undefined;
          const rect = element.getBoundingClientRect();
          return { chartCode: item.chartCode, top: rect.top, bottom: rect.bottom };
        })
        .filter((item): item is { chartCode: string; top: number; bottom: number } => Boolean(item));

      if (cards.length === 0) return;

      const visibleCards = cards.filter(item => item.bottom > 120);
      const sortedCards = (visibleCards.length > 0 ? visibleCards : cards)
        .sort((a, b) => Math.abs(a.top - 140) - Math.abs(b.top - 140));
      const rowTop = sortedCards[0]?.top;
      if (rowTop == null) return;

      const nextActiveCodes = sortedCards
        .filter(item => Math.abs(item.top - rowTop) < 24)
        .slice(0, 3)
        .map(item => item.chartCode);

      setActiveChartCodes(current => (
        current.length === nextActiveCodes.length && current.every((code, index) => code === nextActiveCodes[index])
          ? current
          : nextActiveCodes
      ));
    };

    updateActiveCharts();
    window.addEventListener('scroll', updateActiveCharts, { passive: true });
    window.addEventListener('resize', updateActiveCharts);
    return () => {
      window.removeEventListener('scroll', updateActiveCharts);
      window.removeEventListener('resize', updateActiveCharts);
    };
  }, [isEditMode, renderedLibraryCharts]);

  useEffect(() => {
    if (activeChartCodes.length === 0 || !tocScrollRef.current || isEditMode) {
      return;
    }
    const container = tocScrollRef.current;
    const activeItem = container.querySelector<HTMLButtonElement>(`[data-chart-code="${activeChartCodes[0]}"]`);
    if (!activeItem) return;
    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const nextTop = container.scrollTop + (itemRect.top - containerRect.top) - ((container.clientHeight - itemRect.height) / 2);
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, [activeChartCodes, isEditMode]);

  useEffect(() => {
    if (initializing || !chartCode) {
      setDraft(undefined);
      setDraftPreview(undefined);
      setPublishedSnapshot(undefined);
      return;
    }

    setLoadingDraft(true);
    api.loadChartDraft(chartCode)
      .then(async nextDraft => {
        const normalized = normalizeChartDefinition(nextDraft);
        const component = normalized.components[0];
        const preferredChartName = resolveComponentChartName(component, normalized.chartName);
        ensureDashboardMeta(normalized.chartCode, { category: routeCategory });
        setDraft({ ...normalized, chartName: preferredChartName });

        if (normalized.publishedVersion && normalized.publishedVersion > 0) {
          try {
            const runtime = await api.loadRuntimeChart(chartCode);
            const published = normalizeChartDefinition(runtime.chart);
            setPublishedSnapshot(JSON.stringify({ chartName: published.chartName, components: published.components }));
          } catch {
            setPublishedSnapshot(undefined);
          }
        } else {
          setPublishedSnapshot(undefined);
        }

        if (!component || !canPreview(component)) {
          setDraftPreview(undefined);
          return;
        }
        const preview = await api.previewComponent(component);
        if (component.templateCode === 'table' || component.componentType === 'table') {
          const syncedComponent = syncTableComponentWithModel(
            component,
            resolveModel(dataPools, component.modelCode),
            preview.rows
          );
          setDraft(current => current ? {
            ...current,
            chartName: resolveComponentChartName(syncedComponent, current.chartName),
            components: [syncedComponent]
          } : current);
        }
        setDraftPreview(preview);
      })
      .catch(error => {
        message.error(error instanceof Error ? error.message : '图表配置加载失败');
      })
      .finally(() => setLoadingDraft(false));
  }, [chartCode, dataPools, initializing, routeCategory]);

  useEffect(() => {
    if (!selectedChart || !livePreviewKey || !canPreview(selectedChart)) {
      return;
    }
    const timer = window.setTimeout(() => {
      void previewComponent(selectedChart);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [livePreviewKey]);

  useEffect(() => {
    if (!selectedChart || !tablePreviewKey || !canPreview(selectedChart)) {
      return;
    }
    const timer = window.setTimeout(() => {
      void previewComponent(selectedChart);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [tablePreviewKey]);

  const refreshCharts = async () => {
    const nextCharts = await api.listCharts();
    setCharts(nextCharts);
    return nextCharts;
  };

  const syncCategoryOrder = (orderedCharts: ChartCatalogItem[]) => {
    orderedCharts.forEach((item, index) => {
      ensureDashboardMeta(item.chartCode, { category: routeCategory, order: index + 1 });
    });
    setCharts(current => [...current]);
  };

  const moveLibraryChart = (sourceChartCode: string, targetChartCode: string) => {
    if (sortMode !== 'manual' || sourceChartCode === targetChartCode) return;
    const sourceIndex = libraryCharts.findIndex(item => item.chartCode === sourceChartCode);
    const targetIndex = libraryCharts.findIndex(item => item.chartCode === targetChartCode);
    if (sourceIndex < 0 || targetIndex < 0) return;
    syncCategoryOrder(reorderItemsPreview(libraryCharts, sourceIndex, targetIndex));
  };

  const handleLibraryDragStart = (event: DragEvent<HTMLElement>, sourceChartCode: string) => {
    if (sortMode !== 'manual') {
      event.preventDefault();
      return;
    }
    setDraggingChartCode(sourceChartCode);
    setDragOverChartCode(undefined);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', sourceChartCode);
  };

  const handleLibraryDrop = (event: DragEvent<HTMLElement>, targetChartCode: string) => {
    event.preventDefault();
    const sourceChartCode = draggingChartCode || event.dataTransfer.getData('text/plain');
    if (sourceChartCode) moveLibraryChart(sourceChartCode, targetChartCode);
    setDraggingChartCode(undefined);
    setDragOverChartCode(undefined);
  };

  const scrollToChartCard = (targetChartCode: string) => {
    const targetIndex = renderedLibraryCharts.findIndex(item => item.chartCode === targetChartCode);
    const nextActive = targetIndex >= 0
      ? renderedLibraryCharts.slice(targetIndex, targetIndex + 3).map(item => item.chartCode)
      : [targetChartCode];
    setActiveChartCodes(nextActive);
    document.getElementById(`designer-chart-card-${targetChartCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const applyDraftComponent = (component: DashboardComponent) => {
    setDraft(current => current ? {
      ...current,
      chartName: resolveComponentChartName(component, current.chartName),
      components: [component]
    } : current);
  };

  const previewComponent = async (component: DashboardComponent) => {
    if (!draft) return;
    if (!canPreview(component)) {
      setDraftPreview(undefined);
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
    setDraftPreview(preview);
  };

  const saveDraft = async () => {
    if (!draft) return undefined;
    const saved = await api.saveChartDraft({
      ...draft,
      chartName: resolveComponentChartName(draft.components[0], draft.chartName),
      components: draft.components[0] ? [draft.components[0]] : []
    });
    const normalized = normalizeChartDefinition(saved);
    const nextDraft = {
      ...normalized,
      chartName: resolveComponentChartName(normalized.components[0], normalized.chartName)
    };
    setDraft(nextDraft);
    updateChartDraftMeta(normalized.chartCode, { draftSavedAt: new Date().toISOString() });
    await refreshCharts();
    return nextDraft;
  };

  const createChart = async () => {
    const values = await form.validateFields();
    if (templates.length === 0 || dataPools.length === 0) {
      message.warning('当前缺少模板或数据池，无法新建图表');
      return;
    }
    setCreating(true);
    try {
      const template =
        templates.find(item => (item.capability?.renderer ?? item.rendererCode) === 'cartesian_combo')
        ?? templates[0];
      const chartTitle = values.name.trim();
      const baseComponent = createComponentFromTemplate(template, dataPools[0].dataPoolCode, 0);
      const component = {
        ...baseComponent,
        title: chartTitle,
        dslConfig: {
          ...baseComponent.dslConfig,
          visualDsl: {
            ...baseComponent.dslConfig.visualDsl,
            title: chartTitle
          }
        }
      };
      const nextDraft: ChartDefinition = {
        chartCode: '',
        chartName: resolveComponentChartName(component, chartTitle),
        status: 'DRAFT',
        publishedVersion: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        components: [component]
      };

      const savedDraft = normalizeChartDefinition(await api.saveChartDraft(nextDraft));
      const savedChartCode = savedDraft.chartCode;
      const refreshedCharts = await refreshCharts();
      ensureDashboardMeta(savedChartCode, {
        category: values.category,
        order: filterChartsByCategory(refreshedCharts, values.category, false).length
      });
      updateChartDraftMeta(savedChartCode, { draftSavedAt: new Date().toISOString() });
      setCreateOpen(false);
      form.resetFields();
      message.success('新图表已创建');
      navigate(`/designer/${values.category}/${savedChartCode}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新建图表失败');
    } finally {
      setCreating(false);
    }
  };

  const deleteChart = async (targetChartCode: string) => {
    await api.deleteChartDraft(targetChartCode);
    removeDashboardMeta(targetChartCode);
    removeChartDraftMeta(targetChartCode);
    await refreshCharts();
    message.success('图表已删除');
    if (chartCode === targetChartCode) {
      navigate(`/designer/${routeCategory}`);
    }
  };

  if (initializing || loadingDraft) {
    return <Spin />;
  }

  if (!isEditMode) {
    return (
      <>
        <div className="page-header designer-library-header">
          <div>
            <h2 className="page-title">指标配置（面向IT人员使用）</h2>
            <div className="page-subtitle">这里以图库方式展示当前分类下的图表，可直接预览、修改、删除、拖拽排序，也可以新建图表。</div>
          </div>
        </div>
        <div className="page-header compact">
          <div className="favorites-filter-nav">
            {DASHBOARD_CATEGORIES.map(item => (
              <Button
                key={item.key}
                type={routeCategory === item.key ? 'primary' : 'default'}
                onClick={() => navigate(`/designer/${item.key}`)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Space wrap size={12}>
            <Input.Search
              allowClear
              placeholder="搜索图表名称"
              style={{ width: 220 }}
              value={searchKeyword}
              onChange={event => setSearchKeyword(event.target.value)}
            />
            <Select
              style={{ width: 180 }}
              value={sortMode}
              options={[
                { label: '自定义排序', value: 'manual' },
                { label: '时间升序', value: 'time_asc' },
                { label: '时间降序', value: 'time_desc' }
              ]}
              onChange={value => setSortMode(value)}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.setFieldsValue({ name: '', category: routeCategory });
                setCreateOpen(true);
              }}
            >
              新建图表
            </Button>
          </Space>
        </div>

        <div className="page-shell runtime-library-shell">
          <div>
            {loadingLibrary ? <Spin /> : null}
            {renderedLibraryCharts.length > 0 ? (
              <div className="favorites-board-grid public-chart-grid designer-library-grid">
                {renderedLibraryCharts.map(item => {
                  const previewItem = libraryPreviewMap[item.chartCode];
                  return (
                    <article
                      key={item.chartCode}
                      id={`designer-chart-card-${item.chartCode}`}
                      className={`panel-card favorites-board-card public-board-card personal-chart-card designer-library-card${draggingChartCode === item.chartCode ? ' personal-chart-card-dragging' : ''}${dragOverChartCode === item.chartCode && draggingChartCode !== item.chartCode ? ' drag-preview-target' : ''}`}
                      draggable={sortMode === 'manual'}
                      onDragStart={event => handleLibraryDragStart(event, item.chartCode)}
                      onDragEnd={() => {
                        setDraggingChartCode(undefined);
                        setDragOverChartCode(undefined);
                      }}
                      onDragOver={event => event.preventDefault()}
                      onDragEnter={() => {
                        if (draggingChartCode && draggingChartCode !== item.chartCode && dragOverChartCode !== item.chartCode) {
                          setDragOverChartCode(item.chartCode);
                        }
                      }}
                      onDrop={event => handleLibraryDrop(event, item.chartCode)}
                    >
                      <div className="favorites-board-card-head">
                        <div>
                          <h3 className="favorites-board-title">{normalizeDisplayText(item.chartName, item.chartCode)}</h3>
                          <div className="favorites-board-meta">
                            <span>状态 {item.status}</span>
                            <span>排序 {getDashboardMeta(item.chartCode).order}</span>
                          </div>
                        </div>
                        <div className="favorites-card-actions public-chart-card-actions personal-chart-card-actions">
                          <Button icon={<EditOutlined />} onClick={() => navigate(`/designer/${routeCategory}/${item.chartCode}`)}>
                            修改
                          </Button>
                          <span
                            className={`drag-handle-chip${sortMode !== 'manual' ? ' disabled' : ''}`}
                            draggable={sortMode === 'manual'}
                            onDragStart={event => handleLibraryDragStart(event, item.chartCode)}
                            onDragEnd={() => {
                              setDraggingChartCode(undefined);
                              setDragOverChartCode(undefined);
                            }}
                          >
                            <HolderOutlined />
                            <span>拖拽排序</span>
                          </span>
                          <Popconfirm title="确认删除当前图表吗？" okText="删除" cancelText="取消" onConfirm={() => void deleteChart(item.chartCode)}>
                            <Button danger icon={<DeleteOutlined />}>删除</Button>
                          </Popconfirm>
                        </div>
                      </div>
                      <div className="favorites-board-thumb" onClick={() => navigate(`/designer/${routeCategory}/${item.chartCode}`)}>
                        <div className="library-chart-preview">
                          <div className="library-chart-preview-head" />
                          <div className="library-chart-preview-body">
                            {previewItem ? (
                              <ChartRendererCore
                                component={previewItem.component}
                                preview={previewItem.preview}
                                templateCode={previewItem.component.templateCode}
                                viewMode="chart"
                                editable={false}
                                selected={false}
                                thumbnail
                                compact={false}
                                dense
                              />
                            ) : (
                              <Empty description="当前图表暂无预览" />
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="panel-card canvas-card canvas-empty">
                <div className="single-chart-empty">
                  <div className="single-chart-empty-title">当前分类下还没有图表</div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      form.setFieldsValue({ name: '', category: routeCategory });
                      setCreateOpen(true);
                    }}
                  >
                    新建图表
                  </Button>
                </div>
              </div>
            )}
          </div>

          <aside className="panel-card runtime-toc-card">
            <div className="runtime-toc-title">目录导航</div>
            <div className="runtime-toc-scroll" ref={tocScrollRef}>
              <div className="runtime-toc-group">
                <button type="button" className="runtime-toc-group-button active">{getCategoryLabel(routeCategory)}</button>
                <div className="runtime-toc-items">
                  {renderedLibraryCharts.map(item => (
                    <button
                      key={item.chartCode}
                      type="button"
                      data-chart-code={item.chartCode}
                      className={`runtime-toc-item${activeChartCodes.includes(item.chartCode) ? ' active' : ''}`}
                      onClick={() => scrollToChartCard(item.chartCode)}
                    >
                      {normalizeDisplayText(item.chartName, item.chartCode)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        <Modal
          title="新建图表"
          open={createOpen}
          onOk={() => void createChart()}
          onCancel={() => setCreateOpen(false)}
          confirmLoading={creating}
          okText="创建"
          cancelText="取消"
        >
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="图表名称" rules={[{ required: true, message: '请输入图表名称' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="所属指标" rules={[{ required: true, message: '请选择所属指标' }]}>
              <Select options={DASHBOARD_CATEGORIES.map(item => ({ label: item.label, value: item.key }))} />
            </Form.Item>
          </Form>
        </Modal>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/designer/${currentMeta?.category ?? routeCategory}`)}>
            返回图表库
          </Button>
        </div>
        <Space wrap size={12}>
          <Button
            disabled={!draft}
            onClick={async () => {
              try {
                await saveDraft();
                message.success('草稿已保存');
              } catch (error) {
                message.error(error instanceof Error ? error.message : '保存草稿失败');
              }
            }}
          >
            保存草稿
          </Button>
          <Button
            type="primary"
            disabled={!draft}
            onClick={async () => {
              try {
                const normalized = await saveDraft();
                if (!normalized) return;
                const result = await api.publishChart(normalized.chartCode);
                const nextSnapshot = JSON.stringify({ chartName: normalized.chartName, components: normalized.components });
                setPublishedSnapshot(nextSnapshot);
                updateChartDraftMeta(normalized.chartCode, { publishedAt: new Date().toISOString() });
                setDraft({ ...normalized, publishedVersion: result.versionNo, status: 'PUBLISHED' });
                await refreshCharts();
                message.success(`已发布到版本 ${result.versionNo}`);
              } catch (error) {
                message.error(error instanceof Error ? error.message : '发布失败');
              }
            }}
          >
            发布
          </Button>
          <Popconfirm title="确认删除当前图表吗？" okText="删除" cancelText="取消" onConfirm={() => draft && void deleteChart(draft.chartCode)}>
            <Button danger icon={<DeleteOutlined />} disabled={!draft}>删除图表</Button>
          </Popconfirm>
        </Space>
        <div>
          <h2 className="page-title">图表配置</h2>
          {draft ? (
            <div className="page-subtitle">
              当前标题：{resolveComponentChartName(selectedChart, draft.chartName)}
              {' · '}
              发布状态：{isDraftPublished ? '已发布' : '未发布'}
              {' · '}
              保存时间：{formatDateTime(selectedDraftMeta?.draftSavedAt)}
              {' · '}
              上次发布时间：{formatDateTime(selectedDraftMeta?.publishedAt)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="page-shell">
        <div className="single-chart-stage">
          {selectedChart ? (
            <DashboardCanvas
              components={[selectedChart]}
              previews={draftPreview ? { [selectedChart.componentCode]: draftPreview } : {}}
              editable={Boolean(draft)}
              resizable={false}
              dataPools={dataPools}
              selectedComponentCode={selectedChart.componentCode}
              onSelect={() => undefined}
              onLayoutChange={components => {
                const component = components[0];
                if (component) {
                  applyDraftComponent(component);
                }
              }}
              onComponentChange={applyDraftComponent}
              onComponentPreview={component => {
                void previewComponent(component);
              }}
            />
          ) : (
            <div className="canvas-empty single-chart-empty-shell">
              <div className="single-chart-empty">
                <div className="single-chart-empty-title">当前还没有图表</div>
              </div>
            </div>
          )}
        </div>

        <div className="config-panel-shell">
          <ChartConfigPanel
            component={selectedChart}
            dataPools={dataPools}
            templates={templates}
            preview={draftPreview}
            onChange={applyDraftComponent}
            onPreview={() => selectedChart && void previewComponent(selectedChart)}
          />
        </div>
      </div>
    </>
  );
}
