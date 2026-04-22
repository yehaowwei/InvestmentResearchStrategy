import { DeleteOutlined, ExpandOutlined, HolderOutlined } from '@ant-design/icons';
import { Button, Empty, Input, Modal, Popconfirm, Select, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { api } from '../api/client';
import ChartContainer from '../components/ChartContainer';
import ChartRendererCore from '../components/ChartRendererCore';
import type { ChartPreview, DashboardCategoryKey, DashboardComponent } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import { DASHBOARD_CATEGORIES } from '../utils/dashboardCatalog';
import {
  deletePersonalBoard,
  listPersonalCharts,
  reorderPersonalCharts,
  type PersonalChartEntry
} from '../utils/favorites';

type SortMode = 'manual' | 'time_asc' | 'time_desc';

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

function matchChartKeyword(entry: PersonalChartEntry, keyword: string) {
  if (!keyword) return true;
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  const targets = [
    normalizeDisplayText(entry.chart.componentTitle, entry.chart.componentCode),
    entry.chart.componentCode
  ];
  return targets.some(value => value.toLowerCase().includes(normalizedKeyword));
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

export default function PersonalDashboard() {
  const [charts, setCharts] = useState<PersonalChartEntry[]>(listPersonalCharts());
  const [previews, setPreviews] = useState<Record<string, ChartPreview>>({});
  const [activeCategory, setActiveCategory] = useState<'all' | DashboardCategoryKey>('all');
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [draggingChartId, setDraggingChartId] = useState<string>();
  const [dragOverChartId, setDragOverChartId] = useState<string>();
  const [expandedChart, setExpandedChart] = useState<PersonalChartEntry>();
  const [activeChartCodes, setActiveChartCodes] = useState<string[]>([]);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

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

      if (cards.length === 0) {
        return;
      }

      const visibleCards = cards.filter(item => item.bottom > 120);
      const sortedCards = (visibleCards.length > 0 ? visibleCards : cards)
        .sort((a, b) => Math.abs(a.top - 140) - Math.abs(b.top - 140));
      const rowTop = sortedCards[0]?.top;
      if (rowTop == null) {
        return;
      }

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
  }, [renderedCharts]);

  useEffect(() => {
    if (activeChartCodes.length === 0 || !tocScrollRef.current) {
      return;
    }
    const container = tocScrollRef.current;
    const activeItem = container.querySelector<HTMLButtonElement>(`[data-chart-code="${activeChartCodes[0]}"]`);
    if (!activeItem) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const nextTop = container.scrollTop + (itemRect.top - containerRect.top) - ((container.clientHeight - itemRect.height) / 2);
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  }, [activeChartCodes]);

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

  const handlePersonalDragStart = (event: DragEvent<HTMLElement>, sourceId: string) => {
    if (sortMode !== 'manual') {
      event.preventDefault();
      return;
    }
    setDraggingChartId(sourceId);
    setDragOverChartId(undefined);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', sourceId);
  };

  const handlePersonalDrop = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = draggingChartId || event.dataTransfer.getData('text/plain');
    if (sourceId) {
      moveChart(sourceId, targetId);
    }
    setDraggingChartId(undefined);
    setDragOverChartId(undefined);
  };

  const scrollToChartCard = (chartCode: string) => {
    const targetIndex = renderedCharts.findIndex(item => item.chart.componentCode === chartCode);
    const nextActive = targetIndex >= 0
      ? renderedCharts.slice(targetIndex, targetIndex + 3).map(item => item.chart.componentCode)
      : [chartCode];
    setActiveChartCodes(nextActive);
    document.getElementById(`personal-chart-card-${chartCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h2 className="page-title">我的指标</h2>
        </div>
        <Space wrap size={12} />
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
            { label: '时间降序', value: 'time_desc' }
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
                  className={`panel-card favorites-board-card public-board-card personal-board-card personal-chart-card${draggingChartId === item.boardId ? ' personal-chart-card-dragging' : ''}${dragOverChartId === item.boardId && draggingChartId !== item.boardId ? ' drag-preview-target' : ''}`}
                  draggable={sortMode === 'manual'}
                  onDragStart={event => handlePersonalDragStart(event, item.boardId)}
                  onDragEnd={() => {
                    setDraggingChartId(undefined);
                    setDragOverChartId(undefined);
                  }}
                  onDragOver={event => {
                    event.preventDefault();
                  }}
                  onDragEnter={() => {
                    if (draggingChartId && draggingChartId !== item.boardId && dragOverChartId !== item.boardId) {
                      setDragOverChartId(item.boardId);
                    }
                  }}
                  onDrop={event => handlePersonalDrop(event, item.boardId)}
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
                        draggable={sortMode === 'manual'}
                        onDragStart={event => handlePersonalDragStart(event, item.boardId)}
                        onDragEnd={() => {
                          setDraggingChartId(undefined);
                          setDragOverChartId(undefined);
                        }}
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
            {navGroups.map(group => (
              <div key={group.key} className="runtime-toc-group">
                <button
                  type="button"
                  className={`runtime-toc-group-button${activeCategory === 'all' || activeCategory === group.key ? ' active' : ''}`}
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
                      onClick={() => {
                        if (activeCategory === 'all' || activeCategory === group.key) {
                          scrollToChartCard(item.chart.componentCode);
                          return;
                        }
                        setActiveCategory(group.key);
                      }}
                    >
                      {normalizeDisplayText(item.chart.componentTitle, item.chart.componentCode)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
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
    </>
  );
}
