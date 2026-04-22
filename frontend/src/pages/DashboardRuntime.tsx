import { ExpandOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ChartContainer from '../components/ChartContainer';
import ChartRendererCore from '../components/ChartRendererCore';
import type { ChartCatalogItem, ChartDefinition, ChartPreview, DashboardComponent } from '../types/dashboard';
import { normalizeDashboard, normalizeDisplayText } from '../utils/dashboard';
import { createFavoriteFromComponent, isFavorite, removeComponentFromAllBoards } from '../utils/favorites';
import {
  DASHBOARD_CATEGORIES,
  filterChartsByCategory,
  getCategoryLabel,
  normalizeCategoryKey
} from '../utils/dashboardCatalog';

interface RuntimeChartCard {
  chartCode: string;
  chartName: string;
  component: DashboardComponent;
  preview?: ChartPreview;
}

function normalizeSearchKeyword(value: string) {
  return value.trim().toLowerCase();
}

function matchChartKeyword(chart: ChartCatalogItem, keyword: string) {
  if (!keyword) return true;
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  const targets = [
    normalizeDisplayText(chart.chartName, chart.chartCode),
    chart.chartCode
  ];
  return targets.some(value => value.toLowerCase().includes(normalizedKeyword));
}

function toChartDefinition(raw: ChartDefinition) {
  const normalized = normalizeDashboard({
    dashboardCode: raw.chartCode,
    name: raw.chartName,
    status: raw.status,
    publishedVersion: raw.publishedVersion,
    components: raw.components
  });
  return {
    chartCode: normalized.dashboardCode,
    chartName: normalized.name,
    status: normalized.status,
    publishedVersion: normalized.publishedVersion,
    components: normalized.components
  } satisfies ChartDefinition;
}

export default function DashboardRuntime() {
  const navigate = useNavigate();
  const params = useParams();
  const category = normalizeCategoryKey(params.categoryKey);
  const [charts, setCharts] = useState<ChartCatalogItem[]>([]);
  const [runtimeCharts, setRuntimeCharts] = useState<RuntimeChartCard[]>([]);
  const [expandedChart, setExpandedChart] = useState<RuntimeChartCard>();
  const [error, setError] = useState<string>();
  const [activeChartCodes, setActiveChartCodes] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [, setFavoriteVersion] = useState(0);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  const categoryCharts = useMemo(
    () => filterChartsByCategory(charts, category, true).filter(chart => matchChartKeyword(chart, searchKeyword)),
    [category, charts, searchKeyword]
  );

  const categoryNavGroups = useMemo(
    () => DASHBOARD_CATEGORIES.map(item => ({
      category: item,
      charts: filterChartsByCategory(charts, item.key, true).filter(chart => matchChartKeyword(chart, searchKeyword))
    })).filter(group => group.charts.length > 0),
    [charts, searchKeyword]
  );

  useEffect(() => {
    api.listCharts()
      .then(setCharts)
      .catch(loadError => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : '指标中心加载失败');
      });
  }, []);

  useEffect(() => {
    if (categoryCharts.length === 0) {
      setRuntimeCharts([]);
      setActiveChartCodes([]);
      return;
    }

    let cancelled = false;
    Promise.all(
      categoryCharts.map(async item => {
        const runtime = await api.loadRuntimeChart(item.chartCode);
        const normalized = toChartDefinition(runtime.chart);
        const previewPairs = await Promise.all(
          normalized.components.map(async component => [
            component.componentCode,
            await api.previewComponent(component)
          ] as const)
        );
        return normalized.components.map(component => ({
          chartCode: normalized.chartCode,
          chartName: normalized.chartName,
          component,
          preview: Object.fromEntries(previewPairs)[component.componentCode]
        }));
      })
    )
      .then(entries => {
        if (!cancelled) {
          const nextCharts = entries.flat();
          setRuntimeCharts(nextCharts);
          setActiveChartCodes(nextCharts.slice(0, 3).map(item => item.chartCode));
        }
      })
      .catch(loadError => {
        console.error(loadError);
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '指标中心加载失败');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryCharts]);

  useEffect(() => {
    if (runtimeCharts.length === 0) {
      setActiveChartCodes([]);
      return;
    }

    const updateActiveChart = () => {
      const cards = runtimeCharts
        .map(item => {
          const element = document.getElementById(`runtime-chart-card-${item.chartCode}`);
          if (!element) return undefined;
          const rect = element.getBoundingClientRect();
          return { chartCode: item.chartCode, top: rect.top, bottom: rect.bottom };
        })
        .filter((item): item is { chartCode: string; top: number; bottom: number } => Boolean(item));

      if (cards.length === 0) {
        return;
      }

      const visibleCards = cards.filter(item => item.bottom > 120);
      const sortedCards = (visibleCards.length > 0 ? visibleCards : cards)
        .sort((a, b) => Math.abs(a.top - 140) - Math.abs(b.top - 140))[0];
      const rowTop = sortedCards?.top;
      if (rowTop == null) {
        return;
      }

      const nextActiveCodes = (visibleCards.length > 0 ? visibleCards : cards)
        .filter(item => Math.abs(item.top - rowTop) < 24)
        .slice(0, 3)
        .map(item => item.chartCode);

      setActiveChartCodes(current => (
        current.length === nextActiveCodes.length && current.every((code, index) => code === nextActiveCodes[index])
          ? current
          : nextActiveCodes
      ));
    };

    updateActiveChart();
    window.addEventListener('scroll', updateActiveChart, { passive: true });
    window.addEventListener('resize', updateActiveChart);
    return () => {
      window.removeEventListener('scroll', updateActiveChart);
      window.removeEventListener('resize', updateActiveChart);
    };
  }, [runtimeCharts]);

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

  useEffect(() => {
    const syncFavorites = () => setFavoriteVersion(value => value + 1);
    window.addEventListener('storage', syncFavorites);
    window.addEventListener('bi-dashboard-favorites-changed', syncFavorites as EventListener);
    return () => {
      window.removeEventListener('storage', syncFavorites);
      window.removeEventListener('bi-dashboard-favorites-changed', syncFavorites as EventListener);
    };
  }, []);

  const favoriteChart = (component: DashboardComponent, sourceChart: ChartDefinition) => {
    const existed = isFavorite(component.componentCode);
    createFavoriteFromComponent(sourceChart.chartCode, sourceChart.chartName, component, {
      primaryLabel: getCategoryLabel(category),
      secondaryLabel: normalizeDisplayText(component.dslConfig.visualDsl.title || component.title, component.componentCode)
    });
    message.success(existed ? '该图表已在我的指标中' : '图表已加入我的指标');
  };

  const unfavoriteChart = (component: DashboardComponent) => {
    removeComponentFromAllBoards(component.componentCode);
    setFavoriteVersion(value => value + 1);
    message.success('图表已取消收藏');
  };

  const scrollToChartCard = (chartCode: string) => {
    const targetIndex = runtimeCharts.findIndex(item => item.chartCode === chartCode);
    const nextActive = targetIndex >= 0 ? runtimeCharts.slice(targetIndex, targetIndex + 3).map(item => item.chartCode) : [chartCode];
    setActiveChartCodes(nextActive);
    document.getElementById(`runtime-chart-card-${chartCode}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (error) {
    return <Alert type="error" showIcon message="指标中心加载失败" description={error} />;
  }

  return (
    <div>
      <div className="page-header compact">
        <div className="favorites-filter-nav">
          {DASHBOARD_CATEGORIES.map(item => (
            <Button
              key={item.key}
              type={category === item.key ? 'primary' : 'default'}
              onClick={() => navigate(`/runtime/${item.key}`)}
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
          <div>
            <h2 className="page-title">{getCategoryLabel(category)}</h2>
          </div>
        </Space>
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {runtimeCharts.length > 0 ? (
            <div className="favorites-board-grid public-chart-grid">
              {runtimeCharts.map(item => {
                const favored = isFavorite(item.component.componentCode);
                return (
                  <article
                    key={`${item.chartCode}:${item.component.componentCode}`}
                    id={`runtime-chart-card-${item.chartCode}`}
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
                        <Button icon={<ExpandOutlined />} onClick={() => setExpandedChart(item)}>
                          放大查看
                        </Button>
                        {favored ? (
                          <Popconfirm
                            title="确认取消收藏当前图表吗？"
                            okText="确认"
                            cancelText="取消"
                            onConfirm={() => unfavoriteChart(item.component)}
                          >
                            <Button
                              icon={<StarFilled />}
                              type="primary"
                              className="favorite-action-button is-favorited"
                            >
                              已收藏
                            </Button>
                          </Popconfirm>
                        ) : (
                          <Button
                            icon={<StarOutlined />}
                            type="default"
                            className="favorite-action-button"
                            onClick={() => {
                              favoriteChart(item.component, {
                                chartCode: item.chartCode,
                                chartName: item.chartName,
                                status: 'PUBLISHED',
                                components: [item.component]
                              });
                              setFavoriteVersion(value => value + 1);
                            }}
                          >
                            收藏图表
                          </Button>
                        )}
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
                );
              })}
            </div>
          ) : (
            <div className="panel-card canvas-card canvas-empty">
              <Empty description="当前分类下暂无已发布图表" />
            </div>
          )}
        </div>

        <aside className="panel-card runtime-toc-card">
          <div className="runtime-toc-title">目录导航</div>
          <div className="runtime-toc-scroll" ref={tocScrollRef}>
            {categoryNavGroups.map(group => (
              <div key={group.category.key} className="runtime-toc-group">
                <button
                  type="button"
                  className={`runtime-toc-group-button${category === group.category.key ? ' active' : ''}`}
                  onClick={() => navigate(`/runtime/${group.category.key}`)}
                >
                  {group.category.label}
                </button>
                <div className="runtime-toc-items">
                  {group.charts.map(chart => (
                    <button
                      key={`${group.category.key}:${chart.chartCode}`}
                      type="button"
                      data-chart-code={chart.chartCode}
                      className={`runtime-toc-item${category === group.category.key && activeChartCodes.includes(chart.chartCode) ? ' active' : ''}`}
                      onClick={() => {
                        if (category !== group.category.key) {
                          navigate(`/runtime/${group.category.key}`);
                          return;
                        }
                        scrollToChartCard(chart.chartCode);
                      }}
                    >
                      {normalizeDisplayText(chart.chartName, chart.chartCode)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <Modal
        title={expandedChart ? normalizeDisplayText(
          expandedChart.component.dslConfig.visualDsl.title || expandedChart.component.title,
          expandedChart.component.componentCode
        ) : '图表详情'}
        open={Boolean(expandedChart)}
        footer={null}
        onCancel={() => setExpandedChart(undefined)}
        width="90vw"
        styles={{ body: { height: '78vh', padding: 16 } }}
      >
        {expandedChart ? (
          <div className="runtime-chart-modal">
            <ChartContainer
              title={normalizeDisplayText(
                expandedChart.component.dslConfig.visualDsl.title || expandedChart.component.title,
                expandedChart.component.componentCode
              )}
              tag={normalizeDisplayText(expandedChart.component.dslConfig.visualDsl.indicatorTag)}
            >
              <ChartRendererCore
                component={expandedChart.component}
                preview={expandedChart.preview}
                templateCode={expandedChart.component.templateCode}
                viewMode="chart"
                editable={false}
                selected={false}
              />
            </ChartContainer>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
