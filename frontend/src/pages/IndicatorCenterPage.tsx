import { ExpandOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Modal, Popconfirm, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import AppSearchInput from '../components/AppSearchInput';
import ChartContainer from '../components/ChartContainer';
import ChartRendererCore from '../components/ChartRendererCore';
import FloatingIndicatorAi from '../components/FloatingIndicatorAi';
import type { ChartCatalogItem, ChartDefinition, DashboardCategoryKey, DashboardComponent } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import { buildChartRuntimeCards, matchCatalogChartKeyword, type ChartRuntimeCard } from '../utils/chartLibrary';
import { createFavoriteFromComponent, isFavorite, removeComponentFromAllBoards } from '../utils/favorites';
import { filterChartsByCategory, getDashboardMeta, getCategoryLabel, normalizeCategoryKey, useDashboardCategories } from '../utils/dashboardCatalog';
import { normalizeSearchKeyword, resolveActiveRowCodes, scrollContainerItemToCenter } from './indicatorPageNavigation';

type RuntimeCategoryKey = 'all' | DashboardCategoryKey;

export default function IndicatorCenterPage() {
  const navigate = useNavigate();
  const params = useParams();
  const category: RuntimeCategoryKey = params.categoryKey === 'all'
    ? 'all'
    : normalizeCategoryKey(params.categoryKey);
  const [charts, setCharts] = useState<ChartCatalogItem[]>([]);
  const [runtimeCharts, setRuntimeCharts] = useState<ChartRuntimeCard[]>([]);
  const [expandedChart, setExpandedChart] = useState<ChartRuntimeCard>();
  const [error, setError] = useState<string>();
  const [activeChartCodes, setActiveChartCodes] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [, setFavoriteVersion] = useState(0);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const categories = useDashboardCategories();
  const runtimeCategories = categories;

  const categoryCharts = useMemo(
    () => (
      category === 'all'
        ? charts.filter(chart => chart.status === 'PUBLISHED')
        : filterChartsByCategory(charts, category, true)
    ).filter(chart => matchCatalogChartKeyword(chart, searchKeyword, normalizeSearchKeyword)),
    [category, charts, searchKeyword]
  );

  const categoryNavGroups = useMemo(() => {
    if (category !== 'all') {
      return [];
    }

    return runtimeCategories.map(item => ({
      category: item,
      charts: filterChartsByCategory(charts, item.key, true).filter(chart => matchCatalogChartKeyword(chart, searchKeyword, normalizeSearchKeyword))
    })).filter(group => group.charts.length > 0);
  }, [runtimeCategories, category, charts, searchKeyword]);

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
    Promise.all(categoryCharts.map(item => buildChartRuntimeCards(item.chartCode)))
      .then(entries => {
        if (cancelled) return;
        const nextCharts = entries.flat();
        setRuntimeCharts(nextCharts);
        setActiveChartCodes(nextCharts.slice(0, 3).map(item => item.chartCode));
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
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${activeChartCodes[0]}"]`);
  }, [activeChartCodes]);

  useEffect(() => {
    const syncFavorites = () => setFavoriteVersion(value => value + 1);
    window.addEventListener('storage', syncFavorites);
    window.addEventListener('strategy-dashboard-favorites-changed', syncFavorites as EventListener);
    return () => {
      window.removeEventListener('storage', syncFavorites);
      window.removeEventListener('strategy-dashboard-favorites-changed', syncFavorites as EventListener);
    };
  }, []);

  const favoriteChart = (component: DashboardComponent, sourceChart: ChartDefinition) => {
    const existed = isFavorite(component.componentCode);
    createFavoriteFromComponent(sourceChart.chartCode, sourceChart.chartName, component, {
      primaryLabel: getCategoryLabel(
        category === 'all' ? getDashboardMeta(sourceChart.chartCode).category : category
      ),
      secondaryLabel: normalizeDisplayText(component.dslConfig.visualDsl.title || component.title, component.componentCode)
    });
    message.success(existed ? '该指标已在我的指标中' : '指标已加入我的指标');
  };

  const unfavoriteChart = (component: DashboardComponent) => {
    removeComponentFromAllBoards(component.componentCode);
    setFavoriteVersion(value => value + 1);
    message.success('指标已取消收藏');
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
          <Button
            type={category === 'all' ? 'primary' : 'default'}
            onClick={() => navigate('/runtime/all')}
          >
            全部
          </Button>
          {runtimeCategories.map(item => (
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
          <AppSearchInput
            allowClear
            placeholder="搜索指标名称"
            className="page-toc-width-search"
            value={searchKeyword}
            onChange={event => setSearchKeyword(event.target.value)}
          />
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
                      </div>
                      <div className="favorites-card-actions public-chart-card-actions">
                        <Button icon={<ExpandOutlined />} onClick={() => setExpandedChart(item)}>
                          放大查看
                        </Button>
                        {favored ? (
                          <Popconfirm
                            title="确认取消收藏当前指标吗？"
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
                            收藏指标
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="favorites-board-thumb">
                      <div className="library-chart-preview">
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
              <Empty description="当前分类下暂无已发布指标" />
            </div>
          )}
        </div>

        <aside className="panel-card runtime-toc-card">
          <div className="runtime-toc-title">{category === 'all' ? '指标中心' : getCategoryLabel(category)}</div>
          <div className="runtime-toc-scroll" ref={tocScrollRef}>
            {category === 'all' ? (
              categoryNavGroups.map(group => (
                <div key={group.category.key} className="runtime-toc-group">
                  <button
                    type="button"
                    className="runtime-toc-group-button active"
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
                        className={`runtime-toc-item${activeChartCodes.includes(chart.chartCode) ? ' active' : ''}`}
                        onClick={() => scrollToChartCard(chart.chartCode)}
                      >
                        {normalizeDisplayText(chart.chartName, chart.chartCode)}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="runtime-toc-items">
                {categoryCharts.map(chart => (
                  <button
                    key={`${category}:${chart.chartCode}`}
                    type="button"
                    data-chart-code={chart.chartCode}
                    className={`runtime-toc-item${activeChartCodes.includes(chart.chartCode) ? ' active' : ''}`}
                    onClick={() => scrollToChartCard(chart.chartCode)}
                  >
                    {normalizeDisplayText(chart.chartName, chart.chartCode)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal
        title={expandedChart ? normalizeDisplayText(
          expandedChart.component.dslConfig.visualDsl.title || expandedChart.component.title,
          expandedChart.component.componentCode
        ) : '指标详情'}
        open={Boolean(expandedChart)}
        footer={null}
        destroyOnHidden
        focusTriggerAfterClose={false}
        wrapClassName="runtime-chart-modal-root"
        onCancel={() => setExpandedChart(undefined)}
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
                key={expandedChart.component.componentCode}
                component={expandedChart.component}
                preview={expandedChart.preview}
                templateCode={expandedChart.component.templateCode}
                viewMode="chart"
                editable={false}
                selected={false}
                forceSlider
                forceDataZoom
              />
            </ChartContainer>
          </div>
        ) : null}
      </Modal>

      <FloatingIndicatorAi
        storageKey={`indicator-center-${category}`}
        pageTitle={category === 'all' ? '指标中心' : getCategoryLabel(category)}
        charts={runtimeCharts.map(item => ({
          id: `${item.chartCode}:${item.component.componentCode}`,
          title: normalizeDisplayText(
            item.component.dslConfig.visualDsl.title || item.component.title,
            item.component.componentCode
          ),
          preview: item.preview
        }))}
      />

    </div>
  );
}
