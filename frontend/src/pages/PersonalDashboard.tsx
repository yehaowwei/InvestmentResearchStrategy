import { ExpandOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Select, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { api } from '../api/client';
import ChartContainer from '../components/ChartContainer';
import ChartRendererCore from '../components/ChartRendererCore';
import type { ChartCatalogItem, ChartPreview, DashboardCategoryKey } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import { buildChartRuntimeCards } from '../utils/chartLibrary';
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
  reorderItemsPreview,
  resolveActiveRowCodes,
  resolveClosestSortIdFromPoint,
  scrollContainerItemToCenter
} from './dashboardPageUtils';
import AddChartModal from './personalDashboard/AddChartModal';
import PersonalChartCard from './personalDashboard/PersonalChartCard';
import {
  matchAvailableChartKeyword,
  matchChartKeyword,
  parseSortTime,
  toComponent,
  type AvailableChartCard,
  type SortMode
} from './personalDashboard/helpers';

const TEXT = {
  title: '\u6211\u7684\u6307\u6807',
  addChart: '\u589e\u52a0\u56fe\u8868',
  all: '\u5168\u90e8',
  currentCategory: '\u5f53\u524d\u5206\u7c7b',
  searchChart: '\u641c\u7d22\u56fe\u8868\u540d\u79f0',
  manualSort: '\u81ea\u5b9a\u4e49\u6392\u5e8f',
  timeAsc: '\u65f6\u95f4\u5347\u5e8f',
  timeDesc: '\u65f6\u95f4\u964d\u5e8f',
  loadFailed: '\u6211\u7684\u6307\u6807\u52a0\u8f7d\u5931\u8d25',
  loadAddableFailed: '\u53ef\u6dfb\u52a0\u56fe\u8868\u52a0\u8f7d\u5931\u8d25',
  removed: '\u56fe\u8868\u5df2\u4ece\u6211\u7684\u6307\u6807\u79fb\u9664',
  added: '\u56fe\u8868\u5df2\u52a0\u5165\u6211\u7684\u6307\u6807',
  emptyCategory: '\u5f53\u524d\u5206\u7c7b\u4e0b\u8fd8\u6ca1\u6709\u56fe\u8868',
  toc: '\u76ee\u5f55\u5bfc\u822a',
  chartDetail: '\u56fe\u8868\u8be6\u60c5'
};

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
      label: DASHBOARD_CATEGORIES.find(item => item.key === activeCategory)?.label ?? TEXT.currentCategory,
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
      label: DASHBOARD_CATEGORIES.find(item => item.key === addChartCategory)?.label ?? TEXT.currentCategory,
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
          message.error(error instanceof Error ? error.message : TEXT.loadFailed);
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
        message.error(error instanceof Error ? error.message : TEXT.loadAddableFailed);
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
          message.error(error instanceof Error ? error.message : TEXT.loadAddableFailed);
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
    message.success(TEXT.removed);
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
    message.success(TEXT.added);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">{TEXT.title}</h2>
        </div>
        <Space wrap size={12}>
          <Button type="primary" onClick={() => setAddChartOpen(true)}>
            {TEXT.addChart}
          </Button>
        </Space>
      </div>

      <div className="favorites-filter-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Button type={activeCategory === 'all' ? 'primary' : 'default'} onClick={() => setActiveCategory('all')}>
          {TEXT.all}
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
          placeholder={TEXT.searchChart}
          style={{ width: 220, marginLeft: 'auto' }}
          value={searchKeyword}
          onChange={event => setSearchKeyword(event.target.value)}
        />
        <Select
          style={{ width: 160 }}
          value={sortMode}
          options={[
            { label: TEXT.manualSort, value: 'manual' },
            { label: TEXT.timeAsc, value: 'time_asc' },
            { label: TEXT.timeDesc, value: 'time_desc' }
          ]}
          onChange={value => setSortMode(value)}
        />
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {filteredCharts.length > 0 ? (
            <div className="favorites-board-grid personal-chart-grid">
              {renderedCharts.map(item => (
                <PersonalChartCard
                  key={item.boardId}
                  item={item}
                  preview={previews[item.chart.componentCode]}
                  dragging={draggingChartId === item.boardId}
                  dragOver={dragOverChartId === item.boardId && draggingChartId !== item.boardId}
                  sortMode={sortMode}
                  onExpand={() => setExpandedChart(item)}
                  onSortStart={handlePersonalSortStart}
                  onRemove={() => removeChart(item)}
                />
              ))}
            </div>
          ) : (
            <div className="panel-card canvas-card canvas-empty">
              <Empty description={TEXT.emptyCategory} />
            </div>
          )}
        </div>

        <aside className="panel-card runtime-toc-card">
          <div className="runtime-toc-title">{TEXT.toc}</div>
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
        title={expandedChart ? normalizeDisplayText(expandedChart.chart.componentTitle, expandedChart.chart.componentCode) : TEXT.chartDetail}
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

      <AddChartModal
        open={addChartOpen}
        loading={addChartLoading}
        category={addChartCategory}
        keyword={addChartKeyword}
        groups={availableChartGroups}
        onClose={() => {
          setAddChartOpen(false);
          setAddChartCategory('all');
          setAddChartKeyword('');
        }}
        onCategoryChange={setAddChartCategory}
        onKeywordChange={setAddChartKeyword}
        onAdd={addChartToPersonal}
      />
    </>
  );
}
