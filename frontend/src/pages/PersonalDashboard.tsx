import { DeleteOutlined, ExpandOutlined, HolderOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Popconfirm, Select, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { api } from '../api/client';
import ChartContainer from '../components/ChartContainer';
import ChartRendererCore from '../components/ChartRendererCore';
import type { ChartCatalogItem, ChartPreview, DashboardCategoryKey, DashboardComponent } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import { buildChartRuntimeCards, type ChartRuntimeCard } from '../utils/chartLibrary';
import { DASHBOARD_CATEGORIES, getCategoryLabel, getDashboardMeta } from '../utils/dashboardCatalog';
import {
  createFavoriteFromComponent,
  deletePersonalBoard,
  isFavorite,
  listPersonalCharts,
  reorderPersonalCharts,
  type PersonalChartEntry
} from '../utils/favorites';
import {
  normalizeSearchKeyword,
  reorderItemsPreview,
  resolveActiveRowCodes,
  resolveClosestSortIdFromPoint,
  scrollContainerItemToCenter
} from './dashboardPageUtils';

type SortMode = 'manual' | 'time_asc' | 'time_desc';

type AvailableChartCard = ChartRuntimeCard;

function parseSortTime(value?: string) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

function matchChartKeyword(entry: PersonalChartEntry, keyword: string) {
  if (!keyword) return true;
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  return [
    normalizeDisplayText(entry.chart.componentTitle, entry.chart.componentCode),
    entry.chart.componentCode
  ].some(value => value.toLowerCase().includes(normalizedKeyword));
}

function toComponent(entry: PersonalChartEntry): DashboardComponent {
  return {
    componentCode: entry.chart.componentCode,
    componentType: 'chart',
    templateCode: entry.chart.templateCode,
    modelCode: entry.chart.modelCode,
    title: entry.chart.componentTitle,
    dslConfig: entry.chart.dslConfig
  };
}

function matchAvailableChartKeyword(chart: AvailableChartCard, keyword: string) {
  if (!keyword) return true;
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  return [
    normalizeDisplayText(chart.component.dslConfig.visualDsl.title || chart.component.title, chart.component.componentCode),
    normalizeDisplayText(chart.chartName, chart.chartCode),
    chart.component.componentCode,
    chart.chartCode
  ].some(value => value.toLowerCase().includes(normalizedKeyword));
}

export default function PersonalDashboard() {
  const [charts, setCharts] = useState<PersonalChartEntry[]>(listPersonalCharts());
  const [previews, setPreviews] = useState<Record<string, ChartPreview>>({});
  const [catalogCharts, setCatalogCharts] = useState<ChartCatalogItem[]>([]);
  const [availableCharts, setAvailableCharts] = useState<AvailableChartCard[]>([]);
  const [activeCategory, setActiveCategory] = useState<'all' | DashboardCategoryKey>('all');
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [addChartKeyword, setAddChartKeyword] = useState('');
  const [addChartCategory, setAddChartCategory] = useState<'all' | DashboardCategoryKey>('all');
  const [addChartOpen, setAddChartOpen] = useState(false);
  const [addChartLoading, setAddChartLoading] = useState(false);
  const [draggingChartId, setDraggingChartId] = useState<string>();
  const [dragOverChartId, setDragOverChartId] = useState<string>();
  const [expandedChart, setExpandedChart] = useState<PersonalChartEntry>();
  const [activeChartCodes, setActiveChartCodes] = useState<string[]>([]);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const draggingChartIdRef = useRef<string>();
  const dragOverChartIdRef = useRef<string>();
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const filteredCharts = useMemo(() => {
    const base = activeCategory === 'all'
      ? charts
      : charts.filter(item => item.primaryLabel === DASHBOARD_CATEGORIES.find(option => option.key === activeCategory)?.label);

    const next = base.filter(item => matchChartKeyword(item, searchKeyword));
    if (sortMode === 'time_asc') {
      next.sort((a, b) => parseSortTime(a.updatedAt ?? a.createdAt) - parseSortTime(b.updatedAt ?? b.createdAt));
    } else if (sortMode === 'time_desc') {
      next.sort((a, b) => parseSortTime(b.updatedAt ?? b.createdAt) - parseSortTime(a.updatedAt ?? a.createdAt));
    } else {
      next.sort((a, b) => a.order - b.order);
    }
    return next;
  }, [activeCategory, charts, searchKeyword, sortMode]);

  const renderedCharts = useMemo(() => {
    if (!draggingChartId || !dragOverChartId || sortMode !== 'manual') {
      return filteredCharts;
    }
    const fromIndex = filteredCharts.findIndex(item => item.boardId === draggingChartId);
    const toIndex = filteredCharts.findIndex(item => item.boardId === dragOverChartId);
    return reorderItemsPreview(filteredCharts, fromIndex, toIndex);
  }, [dragOverChartId, draggingChartId, filteredCharts, sortMode]);

  const navGroups = useMemo(() => {
    if (activeCategory === 'all') {
      return DASHBOARD_CATEGORIES
        .map(item => ({
          key: item.key,
          label: item.label,
          charts: renderedCharts.filter(chart => chart.primaryLabel === item.label)
        }))
        .filter(group => group.charts.length > 0);
    }

    return [{
      key: activeCategory,
      label: DASHBOARD_CATEGORIES.find(item => item.key === activeCategory)?.label ?? '当前分类',
      charts: renderedCharts
    }];
  }, [activeCategory, renderedCharts]);

  const activeCategoryCharts = useMemo(
    () => activeCategory === 'all' ? [] : renderedCharts,
    [activeCategory, renderedCharts]
  );

  const availableChartGroups = useMemo(() => {
    if (addChartCategory === 'all') {
      return DASHBOARD_CATEGORIES.map(item => ({
        key: item.key,
        label: item.label,
        charts: availableCharts.filter(chart =>
          getDashboardMeta(chart.chartCode).category === item.key && matchAvailableChartKeyword(chart, addChartKeyword)
        )
      })).filter(group => group.charts.length > 0);
    }

    return [{
      key: addChartCategory,
      label: DASHBOARD_CATEGORIES.find(item => item.key === addChartCategory)?.label ?? '当前分类',
      charts: availableCharts.filter(chart =>
        getDashboardMeta(chart.chartCode).category === addChartCategory && matchAvailableChartKeyword(chart, addChartKeyword)
      )
    }].filter(group => group.charts.length > 0);
  }, [addChartCategory, addChartKeyword, availableCharts]);

  useEffect(() => {
    const syncCharts = () => {
      const nextCharts = listPersonalCharts();
      setCharts(nextCharts);

      Promise.all(
        nextCharts.map(async item => [
          item.chart.componentCode,
          await api.previewComponent({
            modelCode: item.chart.modelCode,
            dslConfig: item.chart.dslConfig
          })
        ] as const)
      )
        .then(entries => setPreviews(Object.fromEntries(entries)))
        .catch(error => {
          console.error(error);
          message.error(error instanceof Error ? error.message : '我的指标加载失败');
        });
    };

    syncCharts();
    window.addEventListener('storage', syncCharts);
    window.addEventListener('bi-dashboard-favorites-changed', syncCharts as EventListener);
    return () => {
      window.removeEventListener('storage', syncCharts);
      window.removeEventListener('bi-dashboard-favorites-changed', syncCharts as EventListener);
    };
  }, []);

  useEffect(() => {
    api.listCharts()
      .then(setCatalogCharts)
      .catch(error => {
        console.error(error);
        message.error(error instanceof Error ? error.message : '可添加图表加载失败');
      });
  }, []);

  useEffect(() => {
    setActiveChartCodes(renderedCharts.slice(0, 3).map(item => item.chart.componentCode));
  }, [renderedCharts]);

  useEffect(() => {
    if (renderedCharts.length === 0) {
      setActiveChartCodes([]);
      return;
    }

    const updateActiveCharts = () => {
      const cards = renderedCharts
        .map(item => {
          const element = document.getElementById(`personal-chart-card-${item.chart.componentCode}`);
          if (!element) return undefined;
          const rect = element.getBoundingClientRect();
          return { chartCode: item.chart.componentCode, top: rect.top, bottom: rect.bottom };
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
  }, [renderedCharts]);

  useEffect(() => {
    if (activeChartCodes.length === 0 || !tocScrollRef.current) {
      return;
    }
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${activeChartCodes[0]}"]`);
  }, [activeChartCodes]);

  useEffect(() => {
    if (!addChartOpen) {
      return;
    }

    const unfavoritedCharts = catalogCharts
      .filter(chart => chart.status === 'PUBLISHED')
      .filter(chart => !charts.some(item => item.chart.dashboardCode === chart.chartCode));

    if (unfavoritedCharts.length === 0) {
      setAvailableCharts([]);
      setAddChartLoading(false);
      return;
    }

    let cancelled = false;
    setAddChartLoading(true);
    Promise.all(unfavoritedCharts.map(chart => buildChartRuntimeCards(chart.chartCode)))
      .then(entries => {
        if (cancelled) return;
        setAvailableCharts(entries.flat().filter(item => !isFavorite(item.component.componentCode)));
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : '可添加图表加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAddChartLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [addChartOpen, catalogCharts, charts]);

  const removeChart = (target: PersonalChartEntry) => {
    deletePersonalBoard(target.boardId);
    setCharts(listPersonalCharts());
    setPreviews(current => {
      const next = { ...current };
      delete next[target.chart.componentCode];
      return next;
    });
    message.success('图表已从我的指标移除');
  };

  const moveChart = (sourceId: string, targetId: string) => {
    if (sortMode !== 'manual' || sourceId === targetId) {
      return;
    }

    const visibleIds = filteredCharts.map(item => item.boardId);
    const sourceIndex = visibleIds.findIndex(id => id === sourceId);
    const targetIndex = visibleIds.findIndex(id => id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }

    const nextVisibleIds = [...visibleIds];
    const [movedId] = nextVisibleIds.splice(sourceIndex, 1);
    nextVisibleIds.splice(targetIndex, 0, movedId);

    const visibleSet = new Set(nextVisibleIds);
    const reorderedVisible = nextVisibleIds
      .map(id => charts.find(item => item.boardId === id))
      .filter((item): item is PersonalChartEntry => Boolean(item));
    const hiddenCharts = charts.filter(item => !visibleSet.has(item.boardId));
    const reordered = [...reorderedVisible, ...hiddenCharts].map((item, index) => ({ ...item, order: index + 1 }));

    setCharts(reordered);
    reorderPersonalCharts(reordered.map(item => item.boardId));
  };

  const resetPersonalPointerSort = () => {
    const sourceId = draggingChartIdRef.current;
    const targetId = dragOverChartIdRef.current;
    if (sortMode === 'manual' && sourceId && targetId && sourceId !== targetId) {
      moveChart(sourceId, targetId);
    }
    setDraggingChartId(undefined);
    setDragOverChartId(undefined);
    draggingChartIdRef.current = undefined;
    dragOverChartIdRef.current = undefined;
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const handlePersonalSortStart = (event: ReactMouseEvent<HTMLElement>, sourceId: string) => {
    if (sortMode !== 'manual') {
      event.preventDefault();
      return;
    }
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();

    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    setDraggingChartId(sourceId);
    draggingChartIdRef.current = sourceId;
    setDragOverChartId(undefined);
    dragOverChartIdRef.current = undefined;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const targetId = resolveClosestSortIdFromPoint(moveEvent.clientX, moveEvent.clientY, 'data-sort-id');
      if (!targetId || targetId === draggingChartIdRef.current) {
        return;
      }
      if (dragOverChartIdRef.current !== targetId) {
        dragOverChartIdRef.current = targetId;
        setDragOverChartId(targetId);
      }
    };

    const handleMouseUp = () => {
      resetPersonalPointerSort();
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

  const scrollToChartCard = (chartCode: string) => {
    const targetIndex = renderedCharts.findIndex(item => item.chart.componentCode === chartCode);
    const nextActive = targetIndex >= 0
      ? renderedCharts.slice(targetIndex, targetIndex + 3).map(item => item.chart.componentCode)
      : [chartCode];
    setActiveChartCodes(nextActive);
    document.getElementById(`personal-chart-card-${chartCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const addChartToPersonal = (item: AvailableChartCard) => {
    createFavoriteFromComponent(
      item.chartCode,
      item.chartName,
      item.component,
      {
        primaryLabel: getCategoryLabel(getDashboardMeta(item.chartCode).category),
        secondaryLabel: normalizeDisplayText(item.component.dslConfig.visualDsl.title || item.component.title, item.component.componentCode)
      }
    );
    setCharts(listPersonalCharts());
    setAvailableCharts(current => current.filter(chart => chart.component.componentCode !== item.component.componentCode));
    message.success('图表已加入我的指标');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">我的指标</h2>
        </div>
        <Space wrap size={12}>
          <Button type="primary" onClick={() => setAddChartOpen(true)}>
            增加图表
          </Button>
        </Space>
      </div>

      <div className="favorites-filter-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button
          type={activeCategory === 'all' ? 'primary' : 'default'}
          onClick={() => setActiveCategory('all')}
        >
          全部
        </Button>
        {DASHBOARD_CATEGORIES.map(option => (
          <Button
            key={option.key}
            type={activeCategory === option.key ? 'primary' : 'default'}
            onClick={() => setActiveCategory(option.key)}
          >
            {option.label}
          </Button>
        ))}
        <Input.Search
          allowClear
          placeholder="搜索图表名称"
          style={{ width: 220, marginLeft: 'auto' }}
          value={searchKeyword}
          onChange={event => setSearchKeyword(event.target.value)}
        />
        <Select
          style={{ width: 160 }}
          value={sortMode}
          options={[
            { label: '自定义排序', value: 'manual' },
            { label: '时间升序', value: 'time_asc' },
            { label: '时间倒序', value: 'time_desc' }
          ]}
          onChange={value => setSortMode(value)}
        />
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {filteredCharts.length > 0 ? (
            <div className="favorites-board-grid personal-chart-grid">
              {renderedCharts.map(item => (
                <article
                  key={item.boardId}
                  id={`personal-chart-card-${item.chart.componentCode}`}
                  data-sort-id={item.boardId}
                  className={`panel-card favorites-board-card public-board-card personal-board-card personal-chart-card${draggingChartId === item.boardId ? ' personal-chart-card-dragging' : ''}${dragOverChartId === item.boardId && draggingChartId !== item.boardId ? ' drag-preview-target' : ''}`}
                >
                  <div className="favorites-board-card-head">
                    <div>
                      <h3 className="favorites-board-title">
                        {normalizeDisplayText(item.chart.componentTitle, item.chart.componentCode)}
                      </h3>
                      <div className="favorites-board-meta">
                        <span>{item.primaryLabel}</span>
                        <span>{item.secondaryLabel}</span>
                        <span>排序 {item.order}</span>
                      </div>
                    </div>
                    <div className="favorites-card-actions public-chart-card-actions personal-chart-card-actions">
                      <Button icon={<ExpandOutlined />} onClick={() => setExpandedChart(item)}>
                        放大查看
                      </Button>
                      <span
                        className={`drag-handle-chip${sortMode !== 'manual' ? ' disabled' : ''}`}
                        onMouseDown={event => handlePersonalSortStart(event, item.boardId)}
                      >
                        <HolderOutlined />
                        <span>拖拽排序</span>
                      </span>
                      <Popconfirm title="确认删除当前图表吗？" okText="确认" cancelText="取消" onConfirm={() => removeChart(item)}>
                        <Button icon={<DeleteOutlined />} danger>
                          删除
                        </Button>
                      </Popconfirm>
                    </div>
                  </div>
                  <div className="favorites-board-thumb">
                    <div className="library-chart-preview">
                      <div className="library-chart-preview-head">
                        {normalizeDisplayText(item.chart.dslConfig.visualDsl.indicatorTag) ? (
                          <span className="chart-card-tag">
                            {normalizeDisplayText(item.chart.dslConfig.visualDsl.indicatorTag)}
                          </span>
                        ) : null}
                      </div>
                      <div className="library-chart-preview-body">
                        {previews[item.chart.componentCode] ? (
                          <ChartRendererCore
                            component={toComponent(item)}
                            preview={previews[item.chart.componentCode]}
                            templateCode={item.chart.templateCode}
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
              ))}
            </div>
          ) : (
            <div className="panel-card canvas-card canvas-empty">
              <Empty description="当前分类下还没有图表" />
            </div>
          )}
        </div>

        <aside className="panel-card runtime-toc-card">
          <div className="runtime-toc-title">目录导航</div>
          <div className="runtime-toc-scroll" ref={tocScrollRef}>
            {activeCategory === 'all' ? (
              navGroups.map(group => (
                <div key={group.key} className="runtime-toc-group">
                  <button
                    type="button"
                    className="runtime-toc-group-button active"
                    onClick={() => setActiveCategory(group.key)}
                  >
                    {group.label}
                  </button>
                  <div className="runtime-toc-items">
                    {group.charts.map(item => (
                      <button
                        key={`${group.key}:${item.chart.componentCode}`}
                        type="button"
                        data-chart-code={item.chart.componentCode}
                        className={`runtime-toc-item${activeChartCodes.includes(item.chart.componentCode) ? ' active' : ''}`}
                        onClick={() => scrollToChartCard(item.chart.componentCode)}
                      >
                        {normalizeDisplayText(item.chart.componentTitle, item.chart.componentCode)}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="runtime-toc-items">
                {activeCategoryCharts.map(item => (
                  <button
                    key={`${activeCategory}:${item.chart.componentCode}`}
                    type="button"
                    data-chart-code={item.chart.componentCode}
                    className={`runtime-toc-item${activeChartCodes.includes(item.chart.componentCode) ? ' active' : ''}`}
                    onClick={() => scrollToChartCard(item.chart.componentCode)}
                  >
                    {normalizeDisplayText(item.chart.componentTitle, item.chart.componentCode)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal
        title={expandedChart ? normalizeDisplayText(expandedChart.chart.componentTitle, expandedChart.chart.componentCode) : '图表详情'}
        open={Boolean(expandedChart)}
        footer={null}
        onCancel={() => setExpandedChart(undefined)}
        width="90vw"
        styles={{ body: { height: '78vh', padding: 16 } }}
      >
        {expandedChart ? (
          <div className="runtime-chart-modal">
            <ChartContainer
              title={normalizeDisplayText(expandedChart.chart.componentTitle, expandedChart.chart.componentCode)}
              tag={normalizeDisplayText(expandedChart.chart.dslConfig.visualDsl.indicatorTag)}
            >
              <ChartRendererCore
                component={toComponent(expandedChart)}
                preview={previews[expandedChart.chart.componentCode]}
                templateCode={expandedChart.chart.templateCode}
                viewMode="chart"
                editable={false}
                selected={false}
              />
            </ChartContainer>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="增加图表"
        open={addChartOpen}
        footer={null}
        onCancel={() => {
          setAddChartOpen(false);
          setAddChartCategory('all');
          setAddChartKeyword('');
        }}
        width="90vw"
        styles={{ body: { maxHeight: '78vh', overflow: 'auto', padding: 16 } }}
      >
        <div className="favorites-filter-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <Button
            type={addChartCategory === 'all' ? 'primary' : 'default'}
            onClick={() => setAddChartCategory('all')}
          >
            全部
          </Button>
          {DASHBOARD_CATEGORIES.map(option => (
            <Button
              key={`add-${option.key}`}
              type={addChartCategory === option.key ? 'primary' : 'default'}
              onClick={() => setAddChartCategory(option.key)}
            >
              {option.label}
            </Button>
          ))}
          <Input.Search
            allowClear
            placeholder="搜索未收藏图表名称"
            style={{ width: 260 }}
            value={addChartKeyword}
            onChange={event => setAddChartKeyword(event.target.value)}
          />
        </div>
        {availableChartGroups.length > 0 ? (
          <div>
            {availableChartGroups.map(group => (
              <div key={group.key} style={{ marginBottom: 24 }}>
                {addChartCategory === 'all' ? (
                  <div className="runtime-toc-title" style={{ marginBottom: 12 }}>{group.label}</div>
                ) : null}
                <div className="favorites-board-grid public-chart-grid">
                  {group.charts.map(item => (
                    <article
                      key={`${group.key}:${item.component.componentCode}`}
                      className="panel-card favorites-board-card public-board-card"
                    >
                      <div className="favorites-board-card-head">
                        <div>
                          <h3 className="favorites-board-title">
                            {normalizeDisplayText(
                              item.component.dslConfig.visualDsl.title || item.component.title,
                              item.component.componentCode
                            )}
                          </h3>
                          <div className="favorites-board-meta" />
                        </div>
                        <div className="favorites-card-actions public-chart-card-actions">
                          <Button type="primary" onClick={() => addChartToPersonal(item)}>
                            加入我的指标
                          </Button>
                        </div>
                      </div>
                      <div className="favorites-board-thumb">
                        <div className="library-chart-preview">
                          <div className="library-chart-preview-head">
                            {normalizeDisplayText(item.component.dslConfig.visualDsl.indicatorTag) ? (
                              <span className="chart-card-tag">
                                {normalizeDisplayText(item.component.dslConfig.visualDsl.indicatorTag)}
                              </span>
                            ) : null}
                          </div>
                          <div className="library-chart-preview-body">
                            {item.preview ? (
                              <ChartRendererCore
                                component={item.component}
                                preview={item.preview}
                                templateCode={item.component.templateCode}
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
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel-card canvas-card canvas-empty">
            <Empty description={addChartLoading ? '正在加载可添加图表' : '当前没有可添加的未收藏图表'} />
          </div>
        )}
      </Modal>
    </>
  );
}
