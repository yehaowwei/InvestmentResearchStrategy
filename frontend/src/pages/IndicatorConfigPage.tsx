import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  HolderOutlined,
  PlusCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Button, Empty, Form, Input, Modal, Popconfirm, Select, Space, Spin, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AppSearchInput from '../components/AppSearchInput';
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
  normalizeDisplayText,
  resolveModel,
  syncTableComponentWithModel
} from '../utils/dashboard';
import { getChartDraftMeta, removeChartDraftMeta, updateChartDraftMeta } from '../utils/chartDraftMeta';
import {
  createDashboardCategory,
  ensureDashboardMeta,
  filterChartsByCategory,
  getCategoryLabel,
  getDashboardMeta,
  normalizeCategoryKey,
  removeDashboardMeta,
  useDashboardCategories
} from '../utils/dashboardCatalog';
import {
  canPreview,
  formatDateTime,
  loadLibraryPreview,
  type LibraryPreviewItem,
  resolveComponentChartName
} from './indicatorConfigHelpers';
import { normalizeChartDefinition } from '../utils/chartDefinition';
import {
  normalizeSearchKeyword,
  reorderItemsPreview,
  resolveActiveRowCodes,
  resolveClosestSortIdFromPoint,
  scrollContainerItemToCenter
} from './indicatorPageNavigation';

export default function IndicatorConfigPage() {
  const navigate = useNavigate();
  const params = useParams();
  const categories = useDashboardCategories();
  const routeCategory = normalizeCategoryKey(params.categoryKey);
  const chartCode = params.chartCode;
  const [form] = Form.useForm<{ name: string; category: DashboardCategoryKey }>();
  const [categoryForm] = Form.useForm<{ label: string }>();
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
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [draggingChartCode, setDraggingChartCode] = useState<string>();
  const [dragOverChartCode, setDragOverChartCode] = useState<string>();
  const [activeChartCodes, setActiveChartCodes] = useState<string[]>([]);
  const [expandedPreview, setExpandedPreview] = useState<LibraryPreviewItem>();
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const draggingChartCodeRef = useRef<string>();
  const dragOverChartCodeRef = useRef<string>();
  const dragCleanupRef = useRef<(() => void) | null>(null);

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
    return filterChartsByCategory(charts, routeCategory, false).filter(item => {
      if (!keyword) {
        return true;
      }
      return [
        normalizeDisplayText(item.chartName, item.chartCode),
        item.chartCode
      ].some(value => value.toLowerCase().includes(keyword));
    });
  }, [charts, routeCategory, searchKeyword]);

  const renderedLibraryCharts = libraryCharts;

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

  const syncTableComponent = (component: DashboardComponent, preview: ChartPreview) => {
    if (component.templateCode !== 'table' && component.componentType !== 'table') {
      return component;
    }
    return syncTableComponentWithModel(
      component,
      resolveModel(dataPools, component.modelCode),
      preview.rows
    );
  };

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

      const nextActiveCodes = resolveActiveRowCodes(cards);
      if (nextActiveCodes.length === 0) {
        return;
      }

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
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${activeChartCodes[0]}"]`);
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
        const syncedComponent = syncTableComponent(component, preview);
        setDraft(current => current ? {
          ...current,
          chartName: resolveComponentChartName(syncedComponent, current.chartName),
          components: [syncedComponent]
        } : current);
        setDraftPreview(preview);
      })
      .catch(error => {
        message.error(error instanceof Error ? error.message : '指标配置加载失败');
      })
      .finally(() => setLoadingDraft(false));
  }, [chartCode, dataPools, initializing, routeCategory]);

  const previewComponent = async (component: DashboardComponent) => {
    if (!draft) return;
    if (!canPreview(component)) {
      setDraftPreview(undefined);
      return;
    }

    const preview = await api.previewComponent(component);
    const syncedComponent = syncTableComponent(component, preview);
    setDraft(current => current ? {
      ...current,
      chartName: resolveComponentChartName(syncedComponent, current.chartName),
      components: [syncedComponent]
    } : current);
    setDraftPreview(preview);
  };

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

  const categoryOptions = useMemo(
    () => categories.map(item => ({ label: item.label, value: item.key })),
    [categories]
  );

  const currentDraftCategory = draft ? getDashboardMeta(draft.chartCode).category : routeCategory;

  const createCategory = async () => {
    const values = await categoryForm.validateFields();
    setCreatingCategory(true);
    try {
      const createdCategory = createDashboardCategory({ label: values.label });
      categoryForm.resetFields();
      setCategoryCreateOpen(false);
      form.setFieldValue('category', createdCategory.key);
      message.success('指标分类已新增');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新增指标分类失败');
    } finally {
      setCreatingCategory(false);
    }
  };

  const updateDraftCategory = (category: DashboardCategoryKey) => {
    if (!draft) {
      return;
    }
    ensureDashboardMeta(draft.chartCode, { ...getDashboardMeta(draft.chartCode), category });
    setCharts(current => [...current]);
    message.success(`已切换到 ${getCategoryLabel(category)}`);
    navigate(`/designer/${category}/${draft.chartCode}`);
  };

  const syncCategoryOrder = (orderedCharts: ChartCatalogItem[]) => {
    orderedCharts.forEach((item, index) => {
      ensureDashboardMeta(item.chartCode, { category: routeCategory, order: index + 1 });
    });
    setCharts(current => {
      const orderedCodes = orderedCharts.map(item => item.chartCode);
      const visibleSet = new Set(orderedCodes);
      const reorderedVisible = orderedCodes
        .map(chartCode => current.find(item => item.chartCode === chartCode))
        .filter((item): item is ChartCatalogItem => Boolean(item));
      const hiddenCharts = current.filter(item => !visibleSet.has(item.chartCode));
      return [...reorderedVisible, ...hiddenCharts];
    });
  };

  const moveLibraryChart = (sourceChartCode: string, targetChartCode: string) => {
    if (sourceChartCode === targetChartCode) {
      return;
    }
    const sourceIndex = libraryCharts.findIndex(item => item.chartCode === sourceChartCode);
    const targetIndex = libraryCharts.findIndex(item => item.chartCode === targetChartCode);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    syncCategoryOrder(reorderItemsPreview(libraryCharts, sourceIndex, targetIndex));
  };

  const resetLibraryPointerSort = () => {
    const sourceChartCode = draggingChartCodeRef.current;
    const targetChartCode = dragOverChartCodeRef.current;
    if (sourceChartCode && targetChartCode && sourceChartCode !== targetChartCode) {
      moveLibraryChart(sourceChartCode, targetChartCode);
    }
    setDraggingChartCode(undefined);
    setDragOverChartCode(undefined);
    draggingChartCodeRef.current = undefined;
    dragOverChartCodeRef.current = undefined;
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const handleLibrarySortStart = (event: ReactMouseEvent<HTMLElement>, sourceChartCode: string) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();

    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    setDraggingChartCode(sourceChartCode);
    draggingChartCodeRef.current = sourceChartCode;
    setDragOverChartCode(undefined);
    dragOverChartCodeRef.current = undefined;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const targetChartCode = resolveClosestSortIdFromPoint(moveEvent.clientX, moveEvent.clientY, 'data-sort-id');
      if (!targetChartCode || targetChartCode === draggingChartCodeRef.current) {
        if (dragOverChartCodeRef.current !== undefined) {
          dragOverChartCodeRef.current = undefined;
          setDragOverChartCode(undefined);
        }
        return;
      }
      if (dragOverChartCodeRef.current !== targetChartCode) {
        dragOverChartCodeRef.current = targetChartCode;
        setDragOverChartCode(targetChartCode);
      }
    };

    const handleMouseUp = () => {
      resetLibraryPointerSort();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  };

  useEffect(() => () => {
    dragCleanupRef.current?.();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

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
      message.warning('当前缺少模板或数据池，无法新建指标');
      return;
    }

    setCreating(true);
    try {
      const template =
        templates.find(item => (item.capability?.renderer ?? item.rendererCode) === 'cartesian_combo')
        ?? templates[0];
      const chartTitle = values.name.trim();
      const baseComponent = createComponentFromTemplate(template, dataPools[0].modelCode, 0);
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
      message.success('新指标已创建');
      navigate(`/designer/${values.category}/${savedChartCode}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新建指标失败');
    } finally {
      setCreating(false);
    }
  };

  const deleteChart = async (targetChartCode: string) => {
    await api.deleteChartDraft(targetChartCode);
    removeDashboardMeta(targetChartCode);
    removeChartDraftMeta(targetChartCode);
    await refreshCharts();
    message.success('指标已删除');
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
            <h2 className="page-title">指标配置（面向 IT 人员使用）</h2>
          </div>
          <Space wrap size={12}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                form.setFieldsValue({ name: '', category: routeCategory });
                setCreateOpen(true);
              }}
            >
              新建指标
            </Button>
            <Button
              icon={<PlusCircleOutlined />}
              onClick={() => {
                categoryForm.setFieldsValue({ label: '' });
                setCategoryCreateOpen(true);
              }}
            >
              新增分类
            </Button>
          </Space>
        </div>
        <div className="page-header compact designer-library-toolbar">
          <div className="favorites-filter-nav">
            {categories.map(item => (
              <Button
                key={item.key}
                type={routeCategory === item.key ? 'primary' : 'default'}
                onClick={() => navigate(`/designer/${item.key}`)}
              >
                {item.label}
              </Button>
            ))}
          </div>
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
                      data-sort-id={item.chartCode}
                      className={`panel-card favorites-board-card public-board-card personal-chart-card personal-chart-card-sortable designer-library-card${draggingChartCode === item.chartCode ? ' personal-chart-card-dragging' : ''}${dragOverChartCode === item.chartCode && draggingChartCode !== item.chartCode ? ' drag-preview-target' : ''}`}
                    >
                      <div className="favorites-board-card-head">
                        <div>
                          <h3 className="favorites-board-title">{normalizeDisplayText(item.chartName, item.chartCode)}</h3>
                          <div className="favorites-board-meta">
                            <span>状态：{item.status}</span>
                            <span>排序 {getDashboardMeta(item.chartCode).order}</span>
                          </div>
                        </div>
                        <div className="favorites-card-actions public-chart-card-actions personal-chart-card-actions">
                          <Button
                            className="thumbnail-drag-button"
                            icon={<HolderOutlined />}
                            title="拖拽排序"
                            aria-label="拖拽排序"
                            onMouseDown={event => handleLibrarySortStart(event, item.chartCode)}
                          >
                            拖拽
                          </Button>
                          <Button
                            icon={<ExpandOutlined />}
                            onClick={() => previewItem && setExpandedPreview(previewItem)}
                            disabled={!previewItem}
                          >
                            放大
                          </Button>
                          <Button icon={<EditOutlined />} onClick={() => navigate(`/designer/${routeCategory}/${item.chartCode}`)}>
                            修改
                          </Button>
                          <Popconfirm title="确认删除当前指标吗？" okText="删除" cancelText="取消" onConfirm={() => void deleteChart(item.chartCode)}>
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
                              <Empty description="当前指标暂无预览" />
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
                  <div className="single-chart-empty-title">当前分类下还没有指标</div>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      form.setFieldsValue({ name: '', category: routeCategory });
                      setCreateOpen(true);
                    }}
                  >
                    新建指标
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gap: 12, alignSelf: 'start' }}>
            <AppSearchInput
              allowClear
              placeholder="搜索指标名称"
              className="page-toc-width-search"
              style={{ width: '100%' }}
              value={searchKeyword}
              onChange={event => setSearchKeyword(event.target.value)}
            />
            <aside className="panel-card runtime-toc-card">
              <div className="runtime-toc-title">导航</div>
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
        </div>

        <Modal
          title="新建指标"
          open={createOpen}
          onOk={() => void createChart()}
          onCancel={() => setCreateOpen(false)}
          confirmLoading={creating}
          okText="创建"
          cancelText="取消"
        >
          <Form form={form} layout="vertical">
            <Form.Item name="name" label="指标名称" rules={[{ required: true, message: '请输入指标名称' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="所属指标" rules={[{ required: true, message: '请选择所属指标' }]}>
              <Select options={categoryOptions} />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title="新增指标分类"
          open={categoryCreateOpen}
          onOk={() => void createCategory()}
          onCancel={() => setCategoryCreateOpen(false)}
          confirmLoading={creatingCategory}
          okText="创建"
          cancelText="取消"
        >
          <Form form={categoryForm} layout="vertical">
            <Form.Item
              name="label"
              label="分类名称"
              rules={[{ required: true, message: '请输入分类名称' }]}
            >
              <Input placeholder="例如：宏观景气指标" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={expandedPreview ? resolveComponentChartName(expandedPreview.component) : '指标预览'}
          open={Boolean(expandedPreview)}
          footer={null}
          onCancel={() => setExpandedPreview(undefined)}
          width="90vw"
          styles={{ body: { height: '72vh', padding: 16 } }}
        >
          {expandedPreview ? (
            <ChartRendererCore
              component={expandedPreview.component}
              preview={expandedPreview.preview}
              templateCode={expandedPreview.component.templateCode}
              viewMode="chart"
              editable={false}
              selected={false}
              compact={false}
              dense={false}
              forceSlider
              forceDataZoom
            />
          ) : null}
        </Modal>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <Space size={12} align="center">
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/designer/${currentMeta?.category ?? routeCategory}`)}>
            返回指标库
          </Button>
          <h2 className="page-title" style={{ marginBottom: 0 }}>指标配置</h2>
        </Space>
        <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
          <Space wrap size={12}>
            <Select
              value={currentDraftCategory}
              style={{ width: 180 }}
              options={categoryOptions}
              onChange={value => updateDraftCategory(value)}
            />
            <Button
              icon={<ExpandOutlined />}
              disabled={!selectedChart || !draftPreview}
              onClick={() => selectedChart && draftPreview && setExpandedPreview({ component: selectedChart, preview: draftPreview })}
            >
              放大查看
            </Button>
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
            <Popconfirm title="确认删除当前指标吗？" okText="删除" cancelText="取消" onConfirm={() => draft && void deleteChart(draft.chartCode)}>
              <Button danger icon={<DeleteOutlined />} disabled={!draft}>删除指标</Button>
            </Popconfirm>
          </Space>
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
                <div className="single-chart-empty-title">当前还没有指标</div>
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

      <Modal
        title="新增指标分类"
        open={categoryCreateOpen}
        onOk={() => void createCategory()}
        onCancel={() => setCategoryCreateOpen(false)}
        confirmLoading={creatingCategory}
        okText="创建"
        cancelText="取消"
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item
            name="label"
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="例如：宏观景气指标" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={expandedPreview ? resolveComponentChartName(expandedPreview.component, draft?.chartName) : '指标预览'}
        open={Boolean(expandedPreview)}
        footer={null}
        onCancel={() => setExpandedPreview(undefined)}
        width="90vw"
        styles={{ body: { height: '72vh', padding: 16 } }}
      >
        {expandedPreview ? (
          <ChartRendererCore
            component={expandedPreview.component}
            preview={expandedPreview.preview}
            templateCode={expandedPreview.component.templateCode}
            viewMode="chart"
            editable={false}
            selected={false}
            compact={false}
            dense={false}
            forceSlider
            forceDataZoom
          />
        ) : null}
      </Modal>
    </>
  );
}

