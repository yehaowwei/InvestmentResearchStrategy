import { ArrowLeftOutlined, ExpandOutlined, FolderOpenOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ChartContainer from '../components/ChartContainer';
import ChartRendererCore from '../components/ChartRendererCore';
import type { ChartPreview } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import {
  favoriteStrategy,
  getStrategy,
  isStrategyFavorited,
  listStrategies,
  strategyChangeEventName,
  type StrategyChartSnapshot,
  type StrategyRecord
} from '../utils/strategies';
import { normalizeSearchKeyword, resolveActiveRowCodes, scrollContainerItemToCenter } from './dashboardPageUtils';

const TEXT = {
  previewLoadFailed: '\u7b56\u7565\u9884\u89c8\u52a0\u8f7d\u5931\u8d25',
  detailLoadFailed: '\u7b56\u7565\u8be6\u60c5\u52a0\u8f7d\u5931\u8d25',
  title: '\u7b56\u7565\u4e2d\u5fc3',
  searchPlaceholder: '\u641c\u7d22\u7b56\u7565\u540d\u79f0\u6216\u6307\u6807\u540d\u79f0',
  chartCountSuffix: '\u4e2a\u6307\u6807',
  openStrategy: '\u8fdb\u5165\u7b56\u7565',
  favorite: '\u6536\u85cf\u7b56\u7565',
  favorited: '\u5df2\u6536\u85cf',
  favoritedMessage: '\u7b56\u7565\u5df2\u6536\u85cf\u5230\u6211\u7684\u7b56\u7565',
  noPreview: '\u5f53\u524d\u7b56\u7565\u6682\u65e0\u9884\u89c8',
  noStrategy: '\u8fd8\u6ca1\u6709\u914d\u7f6e\u597d\u7684\u7b56\u7565',
  toc: '\u5bfc\u822a',
  notFound: '\u672a\u627e\u5230\u7b56\u7565',
  notFoundDescription: '\u8fd9\u4e2a\u7b56\u7565\u53ef\u80fd\u5df2\u7ecf\u88ab\u5220\u9664\u3002',
  back: '\u8fd4\u56de\u7b56\u7565\u4e2d\u5fc3',
  detailFallback: '\u6309\u6307\u6807\u4e2d\u5fc3\u7684\u7f29\u7565\u56fe\u5f62\u5f0f\u5c55\u793a\u5f53\u524d\u7b56\u7565\u4e0b\u7684\u6240\u6709\u6307\u6807\u3002',
  enlarge: '\u653e\u5927\u67e5\u770b',
  chartDetail: '\u6307\u6807\u8be6\u60c5',
  noChartPreview: '\u5f53\u524d\u6307\u6807\u6682\u65e0\u9884\u89c8',
  noCharts: '\u5f53\u524d\u7b56\u7565\u8fd8\u6ca1\u6709\u6307\u6807'
};

function buildComponent(snapshot: StrategyChartSnapshot) {
  return {
    componentCode: snapshot.componentCode,
    componentType: snapshot.templateCode === 'table' || Boolean(snapshot.dslConfig.tableDsl) ? 'table' : 'chart',
    templateCode: snapshot.templateCode,
    modelCode: snapshot.modelCode,
    title: snapshot.componentTitle,
    dslConfig: snapshot.dslConfig
  };
}

function matchStrategyKeyword(strategy: StrategyRecord, keyword: string) {
  if (!keyword) {
    return true;
  }
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  return [
    strategy.strategyName,
    strategy.description,
    ...strategy.charts.map(item => item.componentTitle)
  ].some(value => value.toLowerCase().includes(normalizedKeyword));
}

function StrategyOverview() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyRecord[]>(listStrategies());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [previewMap, setPreviewMap] = useState<Record<string, ChartPreview>>({});
  const [activeChartMap, setActiveChartMap] = useState<Record<string, string>>({});
  const [activeStrategyIds, setActiveStrategyIds] = useState<string[]>([]);
  const [expandedChart, setExpandedChart] = useState<StrategyChartSnapshot>();
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  const filteredStrategies = useMemo(
    () => strategies.filter(item => matchStrategyKeyword(item, searchKeyword)),
    [searchKeyword, strategies]
  );

  useEffect(() => {
    const syncStrategies = () => setStrategies(listStrategies());
    const eventName = strategyChangeEventName();
    const personalEventName = strategyChangeEventName('personal');
    window.addEventListener('storage', syncStrategies);
    window.addEventListener(eventName, syncStrategies as EventListener);
    window.addEventListener(personalEventName, syncStrategies as EventListener);
    return () => {
      window.removeEventListener('storage', syncStrategies);
      window.removeEventListener(eventName, syncStrategies as EventListener);
      window.removeEventListener(personalEventName, syncStrategies as EventListener);
    };
  }, []);

  useEffect(() => {
    if (filteredStrategies.length === 0) {
      setPreviewMap({});
      return;
    }

    let cancelled = false;
    Promise.all(
      filteredStrategies.flatMap(strategy => strategy.charts.map(async chart => [
        chart.chartId,
        await api.previewComponent({
          modelCode: chart.modelCode,
          dslConfig: chart.dslConfig
        })
      ] as const))
    )
      .then(entries => {
        if (!cancelled) {
          setPreviewMap(Object.fromEntries(entries));
        }
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : TEXT.previewLoadFailed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filteredStrategies]);

  useEffect(() => {
    setActiveChartMap(current => filteredStrategies.reduce<Record<string, string>>((accumulator, strategy) => {
      const currentActive = current[strategy.strategyId];
      accumulator[strategy.strategyId] = strategy.charts.some(item => item.chartId === currentActive)
        ? currentActive
        : strategy.charts[0]?.chartId ?? '';
      return accumulator;
    }, {}));
  }, [filteredStrategies]);

  useEffect(() => {
    if (filteredStrategies.length === 0) {
      setActiveStrategyIds([]);
      return;
    }

    const updateActiveStrategies = () => {
      const cards = filteredStrategies
        .map(item => {
          const element = document.getElementById(`strategy-card-${item.strategyId}`);
          if (!element) {
            return undefined;
          }
          const rect = element.getBoundingClientRect();
          return { chartCode: item.strategyId, top: rect.top, bottom: rect.bottom };
        })
        .filter((item): item is { chartCode: string; top: number; bottom: number } => Boolean(item));

      const nextActiveIds = resolveActiveRowCodes(cards);
      if (nextActiveIds.length === 0) {
        return;
      }

      setActiveStrategyIds(current => (
        current.length === nextActiveIds.length && current.every((code, index) => code === nextActiveIds[index])
          ? current
          : nextActiveIds
      ));
    };

    updateActiveStrategies();
    window.addEventListener('scroll', updateActiveStrategies, { passive: true });
    window.addEventListener('resize', updateActiveStrategies);
    return () => {
      window.removeEventListener('scroll', updateActiveStrategies);
      window.removeEventListener('resize', updateActiveStrategies);
    };
  }, [filteredStrategies]);

  useEffect(() => {
    if (activeStrategyIds.length === 0 || !tocScrollRef.current) {
      return;
    }
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${activeStrategyIds[0]}"]`);
  }, [activeStrategyIds]);

  const scrollToStrategy = (strategyId: string) => {
    const targetIndex = filteredStrategies.findIndex(item => item.strategyId === strategyId);
    const nextActive = targetIndex >= 0
      ? filteredStrategies.slice(targetIndex, targetIndex + 3).map(item => item.strategyId)
      : [strategyId];
    setActiveStrategyIds(nextActive);
    document.getElementById(`strategy-card-${strategyId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const activateStrategyChart = (
    event: ReactMouseEvent<HTMLButtonElement>,
    strategyId: string,
    chartId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveChartMap(current => (
      current[strategyId] === chartId
        ? current
        : { ...current, [strategyId]: chartId }
    ));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{TEXT.title}</h2>
        </div>
      </div>

      <div className="favorites-filter-nav">
        <Input.Search
          allowClear
          placeholder={TEXT.searchPlaceholder}
          className="page-toc-width-search"
          style={{ marginLeft: 'auto' }}
          value={searchKeyword}
          onChange={event => setSearchKeyword(event.target.value)}
        />
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {filteredStrategies.length > 0 ? (
            <div className="favorites-board-grid strategy-center-grid">
              {filteredStrategies.map(strategy => {
                const activeChartId = activeChartMap[strategy.strategyId];
                const activeChart = strategy.charts.find(item => item.chartId === activeChartId) ?? strategy.charts[0];
                const preview = activeChart ? previewMap[activeChart.chartId] : undefined;
                return (
                  <article
                    key={strategy.strategyId}
                    id={`strategy-card-${strategy.strategyId}`}
                    className="panel-card favorites-board-card strategy-overview-card"
                  >
                    <div className="favorites-board-card-head strategy-overview-head">
                      <div>
                        <h3 className="favorites-board-title">{strategy.strategyName}</h3>
                        <div className="favorites-board-meta">
                          <span>{strategy.charts.length} {TEXT.chartCountSuffix}</span>
                          {strategy.description ? <span>{strategy.description}</span> : null}
                        </div>
                      </div>
                      <div className="favorites-card-actions public-chart-card-actions">
                        <Button icon={<ExpandOutlined />} onClick={() => activeChart && setExpandedChart(activeChart)}>
                          {TEXT.enlarge}
                        </Button>
                        <Button icon={<FolderOpenOutlined />} onClick={() => navigate(`/strategy-center/${strategy.strategyId}`)}>
                          {TEXT.openStrategy}
                        </Button>
                        <Button
                          icon={isStrategyFavorited(strategy.strategyId) ? <StarFilled /> : <StarOutlined />}
                          type={isStrategyFavorited(strategy.strategyId) ? 'primary' : 'default'}
                          onClick={() => {
                            favoriteStrategy(strategy.strategyId);
                            setStrategies(listStrategies());
                            message.success(TEXT.favoritedMessage);
                          }}
                        >
                          {isStrategyFavorited(strategy.strategyId) ? TEXT.favorited : TEXT.favorite}
                        </Button>
                      </div>
                    </div>

                    <div className="strategy-chip-list">
                      {strategy.charts.map(chart => (
                        <button
                          key={chart.chartId}
                          type="button"
                          className={`strategy-chip${chart.chartId === activeChart?.chartId ? ' active' : ''}`}
                          onMouseDown={event => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={event => activateStrategyChart(event, strategy.strategyId, chart.chartId)}
                        >
                          {chart.componentTitle}
                        </button>
                      ))}
                    </div>

                    <div className="favorites-board-thumb">
                      <div className="library-chart-preview strategy-preview-frame">
                        <div className="library-chart-preview-head">
                          <div className="library-chart-preview-title">{activeChart?.componentTitle}</div>
                        </div>
                        <div className="library-chart-preview-body">
                          {activeChart && preview ? (
                            <ChartRendererCore
                              key={activeChart.chartId}
                              component={buildComponent(activeChart)}
                              preview={preview}
                              templateCode={activeChart.templateCode}
                              viewMode="chart"
                              editable={false}
                              selected={false}
                              thumbnail
                              compact={false}
                              dense
                            />
                          ) : (
                            <Empty description={TEXT.noPreview} />
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
              <Empty description={TEXT.noStrategy} />
            </div>
          )}
        </div>

        <aside className="panel-card runtime-toc-card">
          <div className="runtime-toc-title">{TEXT.toc}</div>
          <div className="runtime-toc-scroll" ref={tocScrollRef}>
            <div className="runtime-toc-items">
              {filteredStrategies.map(strategy => (
                <button
                  key={strategy.strategyId}
                  type="button"
                  data-chart-code={strategy.strategyId}
                  className={`runtime-toc-item${activeStrategyIds.includes(strategy.strategyId) ? ' active' : ''}`}
                  onClick={() => scrollToStrategy(strategy.strategyId)}
                >
                  {strategy.strategyName}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Modal
        title={expandedChart?.componentTitle || TEXT.chartDetail}
        open={Boolean(expandedChart)}
        footer={null}
        onCancel={() => setExpandedChart(undefined)}
        width="90vw"
        styles={{ body: { height: '78vh', padding: 16 } }}
      >
        {expandedChart ? (
          <div className="runtime-chart-modal">
            <ChartContainer
              title={expandedChart.componentTitle}
              tag={normalizeDisplayText(expandedChart.dslConfig.visualDsl.indicatorTag)}
            >
              <ChartRendererCore
                component={buildComponent(expandedChart)}
                preview={previewMap[expandedChart.chartId]}
                templateCode={expandedChart.templateCode}
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

function StrategyDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const [strategy, setStrategy] = useState<StrategyRecord | undefined>(() => getStrategy(params.strategyId));
  const [previewMap, setPreviewMap] = useState<Record<string, ChartPreview>>({});
  const [expandedChart, setExpandedChart] = useState<StrategyChartSnapshot>();
  const [activeChartCodes, setActiveChartCodes] = useState<string[]>([]);
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStrategy(getStrategy(params.strategyId));
  }, [params.strategyId]);

  useEffect(() => {
    const syncStrategies = () => setStrategy(getStrategy(params.strategyId));
    const eventName = strategyChangeEventName();
    window.addEventListener('storage', syncStrategies);
    window.addEventListener(eventName, syncStrategies as EventListener);
    return () => {
      window.removeEventListener('storage', syncStrategies);
      window.removeEventListener(eventName, syncStrategies as EventListener);
    };
  }, [params.strategyId]);

  useEffect(() => {
    if (!strategy || strategy.charts.length === 0) {
      setPreviewMap({});
      return;
    }

    let cancelled = false;
    Promise.all(
      strategy.charts.map(async chart => [
        chart.chartId,
        await api.previewComponent({
          modelCode: chart.modelCode,
          dslConfig: chart.dslConfig
        })
      ] as const)
    )
      .then(entries => {
        if (!cancelled) {
          setPreviewMap(Object.fromEntries(entries));
        }
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : TEXT.detailLoadFailed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [strategy]);

  useEffect(() => {
    if (!strategy || strategy.charts.length === 0) {
      setActiveChartCodes([]);
      return;
    }
    setActiveChartCodes(strategy.charts.slice(0, 3).map(item => item.chartId));
  }, [strategy]);

  useEffect(() => {
    if (!strategy || strategy.charts.length === 0) {
      return;
    }

    const updateActiveCharts = () => {
      const cards = strategy.charts
        .map(item => {
          const element = document.getElementById(`strategy-detail-card-${item.chartId}`);
          if (!element) {
            return undefined;
          }
          const rect = element.getBoundingClientRect();
          return { chartCode: item.chartId, top: rect.top, bottom: rect.bottom };
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
  }, [strategy]);

  useEffect(() => {
    if (activeChartCodes.length === 0 || !tocScrollRef.current) {
      return;
    }
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${activeChartCodes[0]}"]`);
  }, [activeChartCodes]);

  if (!strategy) {
    return <Alert type="warning" showIcon message={TEXT.notFound} description={TEXT.notFoundDescription} />;
  }

  const scrollToChart = (chartId: string) => {
    const targetIndex = strategy.charts.findIndex(item => item.chartId === chartId);
    const nextActive = targetIndex >= 0
      ? strategy.charts.slice(targetIndex, targetIndex + 3).map(item => item.chartId)
      : [chartId];
    setActiveChartCodes(nextActive);
    document.getElementById(`strategy-detail-card-${chartId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Space size={12}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/strategy-center')}>
              {TEXT.back}
            </Button>
            <h2 className="page-title" style={{ marginBottom: 0 }}>{strategy.strategyName}</h2>
          </Space>
          <div className="page-subtitle">{strategy.description || TEXT.detailFallback}</div>
        </div>
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {strategy.charts.length > 0 ? (
            <div className="favorites-board-grid strategy-detail-grid">
              {strategy.charts.map(chart => (
                <article
                  key={chart.chartId}
                  id={`strategy-detail-card-${chart.chartId}`}
                  className="panel-card favorites-board-card strategy-indicator-card"
                >
                  <div className="favorites-board-card-head">
                    <div>
                      <h3 className="favorites-board-title">{chart.componentTitle}</h3>
                      <div className="favorites-board-meta">
                        <span>{chart.chartName}</span>
                      </div>
                    </div>
                    <div className="favorites-card-actions public-chart-card-actions">
                      <Button icon={<ExpandOutlined />} onClick={() => setExpandedChart(chart)}>
                        {TEXT.enlarge}
                      </Button>
                    </div>
                  </div>
                  <div className="favorites-board-thumb">
                    <div className="library-chart-preview">
                      <div className="library-chart-preview-head">
                        {normalizeDisplayText(chart.dslConfig.visualDsl.indicatorTag) ? (
                          <span className="chart-card-tag">{normalizeDisplayText(chart.dslConfig.visualDsl.indicatorTag)}</span>
                        ) : null}
                      </div>
                      <div className="library-chart-preview-body">
                        {previewMap[chart.chartId] ? (
                          <ChartRendererCore
                            component={buildComponent(chart)}
                            preview={previewMap[chart.chartId]}
                            templateCode={chart.templateCode}
                            viewMode="chart"
                            editable={false}
                            selected={false}
                            thumbnail
                            compact={false}
                            dense
                          />
                        ) : (
                          <Empty description={TEXT.noChartPreview} />
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel-card canvas-card canvas-empty">
              <Empty description={TEXT.noCharts} />
            </div>
          )}
        </div>

        <aside className="panel-card runtime-toc-card">
          <div className="runtime-toc-title">{TEXT.toc}</div>
          <div className="runtime-toc-scroll" ref={tocScrollRef}>
            <div className="runtime-toc-items">
              {strategy.charts.map(chart => (
                <button
                  key={chart.chartId}
                  type="button"
                  data-chart-code={chart.chartId}
                  className={`runtime-toc-item${activeChartCodes.includes(chart.chartId) ? ' active' : ''}`}
                  onClick={() => scrollToChart(chart.chartId)}
                >
                  {chart.componentTitle}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <Modal
        title={expandedChart?.componentTitle || TEXT.chartDetail}
        open={Boolean(expandedChart)}
        footer={null}
        onCancel={() => setExpandedChart(undefined)}
        width="90vw"
        styles={{ body: { height: '78vh', padding: 16 } }}
      >
        {expandedChart ? (
          <div className="runtime-chart-modal">
            <ChartContainer
              title={expandedChart.componentTitle}
              tag={normalizeDisplayText(expandedChart.dslConfig.visualDsl.indicatorTag)}
            >
              <ChartRendererCore
                component={buildComponent(expandedChart)}
                preview={previewMap[expandedChart.chartId]}
                templateCode={expandedChart.templateCode}
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

export default function StrategyCenter() {
  const params = useParams();
  return params.strategyId ? <StrategyDetail /> : <StrategyOverview />;
}
