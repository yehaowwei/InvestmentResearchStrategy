import {
  ArrowLeftOutlined,
  DeleteOutlined,
  ExpandOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined
} from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ChartContainer from '../components/ChartContainer';
import ChartRendererCore from '../components/ChartRendererCore';
import StrategyChartSelectorModal from './strategy/StrategyChartSelectorModal';
import type { ChartCatalogItem, ChartPreview, TkfAgentMessage, TkfAgentResponse, TkfChartCandidate } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import { getCategoryLabel, getDashboardMeta } from '../utils/dashboardCatalog';
import {
  createStrategy,
  deleteStrategy,
  getMyStrategy,
  listMyStrategies,
  reorderStrategies,
  strategyChangeEventName,
  toStrategyChartSnapshot,
  updateStrategy,
  type StrategyChartSnapshot,
  type StrategyRecord
} from '../utils/strategies';
import { buildChartRuntimeCards, type ChartRuntimeCard } from '../utils/chartLibrary';
import {
  normalizeSearchKeyword,
  reorderItemsPreview,
  resolveActiveRowCodes,
  resolveClosestSortIdFromPoint,
  scrollContainerItemToCenter
} from './dashboardPageUtils';

const TEXT = {
  loadFailed: '\u6211\u7684\u7b56\u7565\u52a0\u8f7d\u5931\u8d25',
  deleted: '\u6211\u7684\u7b56\u7565\u5df2\u5220\u9664',
  updated: '\u6211\u7684\u7b56\u7565\u5df2\u66f4\u65b0',
  created: '\u6211\u7684\u7b56\u7565\u5df2\u521b\u5efa',
  title: '\u6211\u7684\u7b56\u7565',
  subtitle: '\u8fd9\u91cc\u7edf\u4e00\u7ba1\u7406\u4f60\u6536\u85cf\u7684\u7b56\u7565\u548c\u4ece\u6307\u6807\u5e93\u81ea\u5b9a\u4e49\u521b\u5efa\u7684\u7b56\u7565\u3002',
  create: '\u65b0\u589e\u7b56\u7565',
  createTitle: '\u65b0\u5efa\u7b56\u7565',
  saveInfo: '\u4fdd\u5b58\u4fe1\u606f',
  strategyName: '\u7b56\u7565\u540d\u79f0',
  availableCharts: '\u53ef\u9009\u56fe\u8868',
  selectedCharts: '\u5df2\u9009\u56fe\u8868',
  namePlaceholder: '\u8f93\u5165\u7b56\u7565\u540d\u79f0',
  searchPlaceholder: '\u641c\u7d22\u6211\u7684\u7b56\u7565\u6216\u6307\u6807\u540d\u79f0',
  open: '\u8fdb\u5165\u7b56\u7565',
  delete: '\u5220\u9664',
  deleteConfirm: '\u786e\u8ba4\u5220\u9664\u5f53\u524d\u6211\u7684\u7b56\u7565\u5417\uff1f',
  confirm: '\u786e\u8ba4',
  cancel: '\u53d6\u6d88',
  countSuffix: '\u4e2a\u56fe\u8868',
  noPreview: '\u5f53\u524d\u7b56\u7565\u6682\u65e0\u9884\u89c8',
  noStrategy: '\u8fd8\u6ca1\u6709\u6211\u7684\u7b56\u7565',
  toc: '\u9875\u5185\u5bfc\u822a',
  notFound: '\u672a\u627e\u5230\u6211\u7684\u7b56\u7565',
  notFoundDescription: '\u8fd9\u4e2a\u7b56\u7565\u53ef\u80fd\u5df2\u7ecf\u88ab\u5220\u9664\u3002',
  back: '\u8fd4\u56de\u6211\u7684\u7b56\u7565',
  detailFallback: '\u8fd9\u91cc\u5c55\u793a\u4e2a\u4eba\u7b56\u7565\u4e0b\u7684\u6240\u6709\u56fe\u8868\uff0c\u53ef\u4ee5\u9010\u4e00\u653e\u5927\u67e5\u770b\u3002',
  enlarge: '\u653e\u5927\u67e5\u770b',
  chartDetail: '\u56fe\u8868\u8be6\u60c5',
  noChartPreview: '\u5f53\u524d\u56fe\u8868\u6682\u65e0\u9884\u89c8',
  noCharts: '\u5f53\u524d\u7b56\u7565\u8fd8\u6ca1\u6709\u56fe\u8868',
  removeFromStrategy: '\u79fb\u51fa',
  addToStrategy: '\u52a0\u5165',
  chartRequired: '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u56fe\u8868',
  addChart: '\u65b0\u589e\u56fe\u8868',
  addChartTitle: '\u9009\u62e9\u8981\u52a0\u5165\u7684\u56fe\u8868',
  completeSelect: '\u9009\u62e9\u5b8c\u6210',
  tkfAgent: 'TKF智能体',
  tkfTitle: 'TKF智能体策略助手',
  tkfPlaceholder: '例如：请给我配置一个偏流动性观察的策略，并解释这些图分别反映什么',
  tkfSend: '发送',
  tkfOpenStrategy: '打开策略',
  tkfWelcome: '你可以直接输入“请给我配置一个什么策略”，我会自动挑选已发布图表，生成一个演示型策略并解释这些图在说明什么。',
  tkfEmptyCharts: '当前没有可用图表，暂时不能生成策略',
  tkfCreated: 'TKF 已生成策略',
  tkfModeExplain: '解释策略',
  tkfModeBuild: '构建策略',
  tkfModeTitle: '功能选择',
  tkfDraftTitle: '待保存策略',
  tkfDraftName: '策略名称',
  tkfDraftDescription: '策略说明',
  tkfSaveDraft: '保存到我的策略',
  tkfRemoveChart: '移除图表',
  tkfDraftReady: '策略草稿已生成，请先预览后再保存',
  tkfExplainPlaceholder: '例如：请解释一下流动性观察策略一般看什么，以及这些图分别在说明什么',
  tkfBuildPlaceholder: '例如：请给我配置一个偏流动性观察的策略，并解释这些图分别反映什么',
  tkfDraftSaved: '策略已保存到我的策略',
  tkfDraftMissing: '当前没有待保存的策略草稿',
  tkfDraftNoCharts: '请至少保留一张图表后再保存'
};

interface AgentChatEntry {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  strategyId?: string;
  strategyName?: string;
  chartReasons?: Array<{ chartId: string; reason: string }>;
  fallback?: boolean;
}

type TkfAgentMode = 'explain' | 'build';

interface PendingAgentStrategyDraft {
  strategyName: string;
  description: string;
  charts: ChartRuntimeCard[];
  chartReasons: Array<{ chartId: string; reason: string }>;
  sourceReply: string;
}

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
    ...strategy.charts.map(item => item.componentTitle)
  ].some(value => value.toLowerCase().includes(normalizedKeyword));
}

function matchAvailableChart(card: ChartRuntimeCard, keyword: string) {
  if (!keyword) {
    return true;
  }
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  return [
    normalizeDisplayText(card.chartName, card.chartCode),
    normalizeDisplayText(card.component.dslConfig.visualDsl.title || card.component.title, card.component.componentCode),
    card.chartCode,
    card.component.componentCode
  ].some(value => value.toLowerCase().includes(normalizedKeyword));
}

function TkfAgentModal(props: {
  open: boolean;
  loading: boolean;
  mode: TkfAgentMode;
  messages: AgentChatEntry[];
  pendingDraft?: PendingAgentStrategyDraft;
  inputValue: string;
  onModeChange: (mode: TkfAgentMode) => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onOpenStrategy: (strategyId: string) => void;
  onPendingDraftNameChange: (value: string) => void;
  onRemovePendingChart: (chartId: string) => void;
  onExpandDraftChart: (chart: ChartRuntimeCard) => void;
  onSaveDraft: () => void;
}) {
  return (
    <Modal
      title={TEXT.tkfTitle}
      open={props.open}
      onCancel={props.onCancel}
      footer={null}
      width={920}
      styles={{ body: { padding: 16, maxHeight: '82vh', overflowY: 'auto' } }}
    >
      <div className="strategy-agent-shell">
        <div className="strategy-agent-messages">
          {props.messages.map(item => (
            <div key={item.id} className={`strategy-agent-message strategy-agent-message-${item.role}`}>
              <div className="strategy-agent-bubble">
                <div className="strategy-agent-text">{item.content}</div>
                {item.chartReasons && item.chartReasons.length > 0 ? (
                  <div className="strategy-agent-reasons">
                    {item.chartReasons.map(reason => (
                      <div key={`${item.id}:${reason.chartId}`} className="strategy-agent-reason-item">
                        {reason.reason}
                      </div>
                    ))}
                  </div>
                ) : null}
                {item.strategyId ? (
                  <div className="strategy-agent-actions">
                    <Button size="small" type="primary" onClick={() => props.onOpenStrategy(item.strategyId!)}>
                      {TEXT.tkfOpenStrategy}
                    </Button>
                    {item.strategyName ? <span className="strategy-agent-created-name">{TEXT.tkfCreated}：{item.strategyName}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
        {props.pendingDraft ? (
          <div className="panel-card strategy-agent-draft">
            <div className="strategy-manage-header">
              <span className="strategy-selection-title">{TEXT.tkfDraftTitle}</span>
              <Button type="primary" onClick={props.onSaveDraft}>
                {TEXT.tkfSaveDraft}
              </Button>
            </div>
            <div className="strategy-agent-draft-form">
              <div className="strategy-info-row">
                <span className="strategy-selection-title">{TEXT.tkfDraftName}</span>
                <Input value={props.pendingDraft.strategyName} onChange={event => props.onPendingDraftNameChange(event.target.value)} />
              </div>
              <div className="strategy-info-row">
                <span className="strategy-selection-title">{TEXT.tkfDraftDescription}</span>
                <div className="strategy-agent-draft-description">{props.pendingDraft.description}</div>
              </div>
            </div>
            <div className="favorites-board-grid strategy-config-grid">
              {props.pendingDraft.charts.map(card => (
                <article key={`${card.chartCode}:${card.component.componentCode}`} className="panel-card favorites-board-card public-board-card strategy-picker-card">
                  <div className="favorites-board-card-head">
                    <div>
                      <h3 className="favorites-board-title">
                        {normalizeDisplayText(card.component.dslConfig.visualDsl.title || card.component.title, card.component.componentCode)}
                      </h3>
                      <div className="favorites-board-meta">
                        <span>{getCategoryLabel(getDashboardMeta(card.chartCode).category)}</span>
                        <span>{normalizeDisplayText(card.chartName, card.chartCode)}</span>
                      </div>
                    </div>
                    <div className="favorites-card-actions public-chart-card-actions">
                      <Button icon={<ExpandOutlined />} onClick={() => props.onExpandDraftChart(card)}>
                        {TEXT.enlarge}
                      </Button>
                      <Button danger onClick={() => props.onRemovePendingChart(`${card.chartCode}:${card.component.componentCode}`)}>
                        {TEXT.tkfRemoveChart}
                      </Button>
                    </div>
                  </div>
                  <div className="favorites-board-thumb">
                    <div className="library-chart-preview">
                      <div className="library-chart-preview-head">
                        {normalizeDisplayText(card.component.dslConfig.visualDsl.indicatorTag) ? (
                          <span className="chart-card-tag">{normalizeDisplayText(card.component.dslConfig.visualDsl.indicatorTag)}</span>
                        ) : null}
                      </div>
                      <div className="library-chart-preview-body">
                        {card.preview ? (
                          <ChartRendererCore
                            component={card.component}
                            preview={card.preview}
                            templateCode={card.component.templateCode}
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
              ))}
            </div>
          </div>
        ) : null}
        <div className="strategy-agent-compose-panel">
          <div className="strategy-agent-mode-bar">
            <span className="strategy-selection-title">{TEXT.tkfModeTitle}</span>
            <Space size={8}>
              <Button type={props.mode === 'explain' ? 'primary' : 'default'} onClick={() => props.onModeChange('explain')}>
                {TEXT.tkfModeExplain}
              </Button>
              <Button type={props.mode === 'build' ? 'primary' : 'default'} onClick={() => props.onModeChange('build')}>
                {TEXT.tkfModeBuild}
              </Button>
            </Space>
          </div>
          <div className="strategy-agent-compose">
            <Input.TextArea
              value={props.inputValue}
              placeholder={props.mode === 'build' ? TEXT.tkfBuildPlaceholder : TEXT.tkfExplainPlaceholder}
              autoSize={{ minRows: 3, maxRows: 5 }}
              onChange={event => props.onInputChange(event.target.value)}
              onPressEnter={event => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  props.onSend();
                }
              }}
            />
            <div className="strategy-agent-compose-actions">
              <Button onClick={props.onCancel}>{TEXT.cancel}</Button>
              <Button type="primary" icon={<SendOutlined />} loading={props.loading} onClick={props.onSend}>
                {TEXT.tkfSend}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function MyStrategyOverview() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyRecord[]>(listMyStrategies());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [previewMap, setPreviewMap] = useState<Record<string, ChartPreview>>({});
  const [activeChartMap, setActiveChartMap] = useState<Record<string, string>>({});
  const [activeStrategyIds, setActiveStrategyIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSelectedChartIds, setCreateSelectedChartIds] = useState<string[]>([]);
  const [catalogCharts, setCatalogCharts] = useState<ChartCatalogItem[]>([]);
  const [availableCharts, setAvailableCharts] = useState<ChartRuntimeCard[]>([]);
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentMode, setAgentMode] = useState<TkfAgentMode>('build');
  const [agentInput, setAgentInput] = useState('');
  const [agentMessages, setAgentMessages] = useState<AgentChatEntry[]>([
    { id: 'welcome', role: 'assistant', content: TEXT.tkfWelcome }
  ]);
  const [pendingAgentDraft, setPendingAgentDraft] = useState<PendingAgentStrategyDraft>();
  const [expandedAgentChart, setExpandedAgentChart] = useState<ChartRuntimeCard>();
  const [draggingStrategyId, setDraggingStrategyId] = useState<string>();
  const [dragOverStrategyId, setDragOverStrategyId] = useState<string>();
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const draggingStrategyIdRef = useRef<string>();
  const dragOverStrategyIdRef = useRef<string>();
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const filteredStrategies = useMemo(
    () => strategies.filter(item => matchStrategyKeyword(item, searchKeyword)),
    [searchKeyword, strategies]
  );

  const orderedStrategies = draggingStrategyId && dragOverStrategyId
    ? (() => {
      const fromIndex = filteredStrategies.findIndex(item => item.strategyId === draggingStrategyId);
      const toIndex = filteredStrategies.findIndex(item => item.strategyId === dragOverStrategyId);
      return reorderItemsPreview(filteredStrategies, fromIndex, toIndex);
    })()
    : filteredStrategies;

  const selectableCharts = useMemo(() => availableCharts, [availableCharts]);
  const tkfChartCandidates = useMemo<TkfChartCandidate[]>(() => selectableCharts.map(card => ({
    chartId: `${card.chartCode}:${card.component.componentCode}`,
    chartCode: card.chartCode,
    chartName: normalizeDisplayText(card.chartName, card.chartCode),
    componentCode: card.component.componentCode,
    componentTitle: normalizeDisplayText(card.component.dslConfig.visualDsl.title || card.component.title, card.component.componentCode),
    category: getCategoryLabel(getDashboardMeta(card.chartCode).category),
    indicatorTag: normalizeDisplayText(card.component.dslConfig.visualDsl.indicatorTag)
  })), [selectableCharts]);

  useEffect(() => {
    const syncStrategies = () => setStrategies(listMyStrategies());
    const eventName = strategyChangeEventName('personal');
    window.addEventListener('storage', syncStrategies);
    window.addEventListener(eventName, syncStrategies as EventListener);
    return () => {
      window.removeEventListener('storage', syncStrategies);
      window.removeEventListener(eventName, syncStrategies as EventListener);
    };
  }, []);

  useEffect(() => {
    api.listCharts()
      .then(setCatalogCharts)
      .catch(error => {
        console.error(error);
        message.error(error instanceof Error ? error.message : TEXT.loadFailed);
      });
  }, []);

  useEffect(() => {
    const publishedCharts = catalogCharts.filter(item => item.status === 'PUBLISHED');
    if (publishedCharts.length === 0) {
      setAvailableCharts([]);
      return;
    }

    let cancelled = false;
    Promise.all(publishedCharts.map(item => buildChartRuntimeCards(item.chartCode)))
      .then(entries => {
        if (!cancelled) {
          setAvailableCharts(entries.flat());
        }
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : TEXT.loadFailed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalogCharts]);

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
          message.error(error instanceof Error ? error.message : TEXT.loadFailed);
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
          const element = document.getElementById(`my-strategy-card-${item.strategyId}`);
          if (!element) {
            return undefined;
          }
          const rect = element.getBoundingClientRect();
          return { chartCode: item.strategyId, top: rect.top, bottom: rect.bottom };
        })
        .filter((item): item is { chartCode: string; top: number; bottom: number } => Boolean(item));

      const nextActiveIds = resolveActiveRowCodes(cards);
      if (nextActiveIds.length > 0) {
        setActiveStrategyIds(current => (
          current.length === nextActiveIds.length && current.every((code, index) => code === nextActiveIds[index])
            ? current
            : nextActiveIds
        ));
      }
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

  useEffect(() => () => {
    dragCleanupRef.current?.();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  const removeStrategy = (strategyId: string) => {
    deleteStrategy(strategyId, 'personal');
    setStrategies(listMyStrategies());
    message.success(TEXT.deleted);
  };

  const scrollToStrategy = (strategyId: string) => {
    const targetIndex = filteredStrategies.findIndex(item => item.strategyId === strategyId);
    const nextActive = targetIndex >= 0
      ? filteredStrategies.slice(targetIndex, targetIndex + 3).map(item => item.strategyId)
      : [strategyId];
    setActiveStrategyIds(nextActive);
    document.getElementById(`my-strategy-card-${strategyId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const finishStrategyDrag = () => {
    const sourceId = draggingStrategyIdRef.current;
    const targetId = dragOverStrategyIdRef.current;
    if (sourceId && targetId && sourceId !== targetId) {
      const fromIndex = strategies.findIndex(item => item.strategyId === sourceId);
      const toIndex = strategies.findIndex(item => item.strategyId === targetId);
      const nextStrategies = reorderItemsPreview(strategies, fromIndex, toIndex);
      reorderStrategies(nextStrategies.map(item => item.strategyId), 'personal');
      setStrategies(listMyStrategies());
    }
    setDraggingStrategyId(undefined);
    setDragOverStrategyId(undefined);
    draggingStrategyIdRef.current = undefined;
    dragOverStrategyIdRef.current = undefined;
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const startStrategyDrag = (event: ReactMouseEvent<HTMLElement>, strategyId: string) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragCleanupRef.current?.();
    setDraggingStrategyId(strategyId);
    setDragOverStrategyId(undefined);
    draggingStrategyIdRef.current = strategyId;
    dragOverStrategyIdRef.current = undefined;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const targetId = resolveClosestSortIdFromPoint(moveEvent.clientX, moveEvent.clientY, 'data-my-strategy-sort-id');
      if (!targetId || targetId === draggingStrategyIdRef.current) {
        return;
      }
      if (dragOverStrategyIdRef.current !== targetId) {
        dragOverStrategyIdRef.current = targetId;
        setDragOverStrategyId(targetId);
      }
    };

    const handleMouseUp = () => finishStrategyDrag();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  };

  const handleStrategyCardMouseDown = (event: ReactMouseEvent<HTMLElement>, strategyId: string) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }
    startStrategyDrag(event, strategyId);
  };

  const toggleCreateChart = (chartId: string) => {
    setCreateSelectedChartIds(current => (
      current.includes(chartId)
        ? current.filter(item => item !== chartId)
        : [...current, chartId]
    ));
  };

  const createNewStrategy = () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      message.warning(TEXT.namePlaceholder);
      return;
    }
    if (createSelectedChartIds.length === 0) {
      message.warning(TEXT.chartRequired);
      return;
    }
    const selectedCharts = selectableCharts.filter(item => createSelectedChartIds.includes(`${item.chartCode}:${item.component.componentCode}`));
    const strategy = createStrategy({
      scope: 'personal',
      strategyName: trimmedName,
      charts: selectedCharts.map(toStrategyChartSnapshot)
    });
    setCreateOpen(false);
    setCreateName('');
    setCreateSelectedChartIds([]);
    setStrategies(listMyStrategies());
    message.success(TEXT.created);
    navigate(`/my-strategy/${strategy.strategyId}`);
  };

  const openAgentStrategy = (strategyId: string) => {
    setAgentOpen(false);
    navigate(`/my-strategy/${strategyId}`);
  };

  const savePendingAgentDraft = () => {
    if (!pendingAgentDraft) {
      message.warning(TEXT.tkfDraftMissing);
      return;
    }
    const trimmedName = pendingAgentDraft.strategyName.trim();
    if (!trimmedName) {
      message.warning(TEXT.namePlaceholder);
      return;
    }
    if (pendingAgentDraft.charts.length === 0) {
      message.warning(TEXT.tkfDraftNoCharts);
      return;
    }

    const strategy = createStrategy({
      scope: 'personal',
      strategyName: trimmedName,
      description: pendingAgentDraft.description || pendingAgentDraft.sourceReply,
      charts: pendingAgentDraft.charts.map(toStrategyChartSnapshot)
    });
    setPendingAgentDraft(undefined);
    setStrategies(listMyStrategies());
    setAgentMessages(current => [...current, {
      id: `assistant-saved-${Date.now()}`,
      role: 'assistant',
      content: TEXT.tkfDraftSaved,
      strategyId: strategy.strategyId,
      strategyName: strategy.strategyName
    }]);
    message.success(TEXT.tkfDraftSaved);
  };

  const submitAgentPrompt = async () => {
    const trimmedInput = agentInput.trim();
    if (!trimmedInput) {
      return;
    }
    if (tkfChartCandidates.length === 0) {
      message.warning(TEXT.tkfEmptyCharts);
      return;
    }

    const nextUserMessage: AgentChatEntry = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput
    };
    const nextMessages = [...agentMessages, nextUserMessage];
    setAgentMessages(nextMessages);
    setAgentInput('');
    setAgentLoading(true);

    try {
      const modeInstruction = agentMode === 'build'
        ? '当前功能：构建策略。请生成一套可演示的策略草稿，给出要看的图和中性解释。'
        : '当前功能：解释策略。请优先解释策略含义和应关注的图，不要给决策性结论。';
      const response = await api.tkfAgentChat({
        messages: [
          { role: 'user', content: modeInstruction },
          ...nextMessages.map<TkfAgentMessage>(item => ({
            role: item.role,
            content: item.content
          }))
        ],
        availableCharts: tkfChartCandidates
      });

      const selectedCards = selectableCharts.filter(card => response.selectedChartIds.includes(`${card.chartCode}:${card.component.componentCode}`));
      let strategyId: string | undefined;
      let strategyName: string | undefined;
      if (selectedCards.length > 0) {
        const strategy = createStrategy({
          scope: 'personal',
          strategyName: response.strategyName || 'TKF策略演示',
          description: response.strategyDescription || response.reply,
          charts: selectedCards.map(toStrategyChartSnapshot)
        });
        strategyId = strategy.strategyId;
        strategyName = strategy.strategyName;
        setStrategies(listMyStrategies());
      }

      const assistantMessage: AgentChatEntry = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        strategyId,
        strategyName,
        chartReasons: response.chartReasons,
        fallback: response.fallback
      };
      setAgentMessages(current => [...current, assistantMessage]);
      if (strategyId) {
        message.success(TEXT.tkfCreated);
      }
    } catch (error) {
      console.error(error);
      message.error(error instanceof Error ? error.message : TEXT.loadFailed);
    } finally {
      setAgentLoading(false);
    }
  };

  const submitAgentPromptV2 = async () => {
    const trimmedInput = agentInput.trim();
    if (!trimmedInput) {
      return;
    }
    if (tkfChartCandidates.length === 0) {
      message.warning(TEXT.tkfEmptyCharts);
      return;
    }

    const nextUserMessage: AgentChatEntry = {
      id: `user-v2-${Date.now()}`,
      role: 'user',
      content: trimmedInput
    };
    const nextMessages = [...agentMessages, nextUserMessage];
    setAgentMessages(nextMessages);
    setAgentInput('');
    setAgentLoading(true);

    try {
      const modeInstruction = agentMode === 'build'
        ? '当前功能：构建策略。请生成一套可演示的策略草稿，给出要看的图和中性解释。'
        : '当前功能：解释策略。请优先解释策略含义和应关注的图，不要给决策性结论。';
      const response = await api.tkfAgentChat({
        messages: [
          { role: 'user', content: modeInstruction },
          ...nextMessages.map<TkfAgentMessage>(item => ({
            role: item.role,
            content: item.content
          }))
        ],
        availableCharts: tkfChartCandidates
      });

      const selectedCards = selectableCharts.filter(card => response.selectedChartIds.includes(`${card.chartCode}:${card.component.componentCode}`));
      const nextStrategyName = response.strategyName || 'TKF策略演示';

      if (agentMode === 'build' && selectedCards.length > 0) {
        setPendingAgentDraft({
          strategyName: nextStrategyName,
          description: response.strategyDescription || response.reply,
          charts: selectedCards,
          chartReasons: response.chartReasons,
          sourceReply: response.reply
        });
        message.success(TEXT.tkfDraftReady);
      } else if (agentMode === 'explain') {
        setPendingAgentDraft(undefined);
      }

      setAgentMessages(current => [...current, {
        id: `assistant-v2-${Date.now()}`,
        role: 'assistant',
        content: response.reply,
        strategyName: agentMode === 'build' ? nextStrategyName : undefined,
        chartReasons: response.chartReasons,
        fallback: response.fallback
      }]);
    } catch (error) {
      console.error(error);
      message.error(error instanceof Error ? error.message : TEXT.loadFailed);
    } finally {
      setAgentLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{TEXT.title}</h2>
          <div className="page-subtitle">{TEXT.subtitle}</div>
        </div>
        <Space wrap size={12}>
          <Button icon={<RobotOutlined />} onClick={() => setAgentOpen(true)}>
            {TEXT.tkfAgent}
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {TEXT.create}
          </Button>
        </Space>
      </div>

      <div className="favorites-filter-nav">
        <Input.Search
          allowClear
          placeholder={TEXT.searchPlaceholder}
          style={{ width: 280, marginLeft: 'auto' }}
          value={searchKeyword}
          onChange={event => setSearchKeyword(event.target.value)}
        />
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {orderedStrategies.length > 0 ? (
            <div className="favorites-board-grid strategy-center-grid">
              {orderedStrategies.map(strategy => {
                const activeChartId = activeChartMap[strategy.strategyId];
                const activeChart = strategy.charts.find(item => item.chartId === activeChartId) ?? strategy.charts[0];
                const preview = activeChart ? previewMap[activeChart.chartId] : undefined;
                return (
                  <article
                    key={strategy.strategyId}
                    id={`my-strategy-card-${strategy.strategyId}`}
                    data-my-strategy-sort-id={strategy.strategyId}
                    className={`panel-card favorites-board-card strategy-overview-card${draggingStrategyId === strategy.strategyId ? ' strategy-sort-card-dragging' : ''}${dragOverStrategyId === strategy.strategyId && draggingStrategyId !== strategy.strategyId ? ' strategy-sort-card-drop-target' : ''}`}
                    onMouseDown={event => handleStrategyCardMouseDown(event, strategy.strategyId)}
                  >
                    <div className="favorites-board-card-head strategy-overview-head">
                      <div>
                        <h3 className="favorites-board-title">{strategy.strategyName}</h3>
                        <div className="favorites-board-meta">
                          <span>{strategy.charts.length} {TEXT.countSuffix}</span>
                        </div>
                      </div>
                      <div className="favorites-card-actions public-chart-card-actions">
                        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/my-strategy/${strategy.strategyId}`)}>
                          {TEXT.open}
                        </Button>
                        <Popconfirm
                          title={TEXT.deleteConfirm}
                          okText={TEXT.confirm}
                          cancelText={TEXT.cancel}
                          onConfirm={() => removeStrategy(strategy.strategyId)}
                        >
                          <Button icon={<DeleteOutlined />} danger>
                            {TEXT.delete}
                          </Button>
                        </Popconfirm>
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

      <StrategyChartSelectorModal
        open={createOpen}
        title={TEXT.createTitle}
        charts={selectableCharts}
        selectedChartIds={createSelectedChartIds}
        confirmText={TEXT.completeSelect}
        onToggle={toggleCreateChart}
        onConfirm={createNewStrategy}
        onCancel={() => {
          setCreateOpen(false);
          setCreateName('');
          setCreateSelectedChartIds([]);
        }}
        nameValue={createName}
        namePlaceholder={TEXT.namePlaceholder}
        onNameChange={setCreateName}
      />

      <TkfAgentModal
        open={agentOpen}
        loading={agentLoading}
        mode={agentMode}
        messages={agentMessages}
        pendingDraft={pendingAgentDraft}
        inputValue={agentInput}
        onModeChange={mode => {
          setAgentMode(mode);
          setPendingAgentDraft(undefined);
        }}
        onInputChange={setAgentInput}
        onSend={() => void submitAgentPromptV2()}
        onCancel={() => setAgentOpen(false)}
        onOpenStrategy={openAgentStrategy}
        onPendingDraftNameChange={value => setPendingAgentDraft(current => (current ? { ...current, strategyName: value } : current))}
        onRemovePendingChart={chartId => setPendingAgentDraft(current => current ? {
          ...current,
          charts: current.charts.filter(item => `${item.chartCode}:${item.component.componentCode}` !== chartId),
          chartReasons: current.chartReasons.filter(item => item.chartId !== chartId)
        } : current)}
        onExpandDraftChart={setExpandedAgentChart}
        onSaveDraft={savePendingAgentDraft}
      />

      <Modal
        title={normalizeDisplayText(expandedAgentChart?.component.dslConfig.visualDsl.title || expandedAgentChart?.component.title, TEXT.chartDetail)}
        open={Boolean(expandedAgentChart)}
        footer={null}
        onCancel={() => setExpandedAgentChart(undefined)}
        width="90vw"
        styles={{ body: { height: '78vh', padding: 16 } }}
      >
        {expandedAgentChart ? (
          <div className="runtime-chart-modal">
            <ChartContainer
              title={normalizeDisplayText(expandedAgentChart.component.dslConfig.visualDsl.title || expandedAgentChart.component.title, expandedAgentChart.component.componentCode)}
              tag={normalizeDisplayText(expandedAgentChart.component.dslConfig.visualDsl.indicatorTag)}
            >
              <ChartRendererCore
                component={expandedAgentChart.component}
                preview={expandedAgentChart.preview}
                templateCode={expandedAgentChart.component.templateCode}
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

function MyStrategyDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const [strategy, setStrategy] = useState<StrategyRecord | undefined>(() => getMyStrategy(params.strategyId));
  const [previewMap, setPreviewMap] = useState<Record<string, ChartPreview>>({});
  const [expandedChart, setExpandedChart] = useState<StrategyChartSnapshot>();
  const [activeChartCodes, setActiveChartCodes] = useState<string[]>([]);
  const [draftName, setDraftName] = useState('');
  const [catalogCharts, setCatalogCharts] = useState<ChartCatalogItem[]>([]);
  const [availableCharts, setAvailableCharts] = useState<ChartRuntimeCard[]>([]);
  const [addChartOpen, setAddChartOpen] = useState(false);
  const [addSelectedChartIds, setAddSelectedChartIds] = useState<string[]>([]);
  const [draggingChartId, setDraggingChartId] = useState<string>();
  const [dragOverChartId, setDragOverChartId] = useState<string>();
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const draggingChartIdRef = useRef<string>();
  const dragOverChartIdRef = useRef<string>();
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setStrategy(getMyStrategy(params.strategyId));
  }, [params.strategyId]);

  useEffect(() => {
    const syncStrategies = () => setStrategy(getMyStrategy(params.strategyId));
    const eventName = strategyChangeEventName('personal');
    window.addEventListener('storage', syncStrategies);
    window.addEventListener(eventName, syncStrategies as EventListener);
    return () => {
      window.removeEventListener('storage', syncStrategies);
      window.removeEventListener(eventName, syncStrategies as EventListener);
    };
  }, [params.strategyId]);

  useEffect(() => {
    api.listCharts()
      .then(setCatalogCharts)
      .catch(error => {
        console.error(error);
        message.error(error instanceof Error ? error.message : TEXT.loadFailed);
      });
  }, []);

  useEffect(() => {
    const publishedCharts = catalogCharts.filter(item => item.status === 'PUBLISHED');
    if (publishedCharts.length === 0) {
      setAvailableCharts([]);
      return;
    }

    let cancelled = false;
    Promise.all(publishedCharts.map(item => buildChartRuntimeCards(item.chartCode)))
      .then(entries => {
        if (!cancelled) {
          setAvailableCharts(entries.flat());
        }
      })
      .catch(error => {
        console.error(error);
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : TEXT.loadFailed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalogCharts]);

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
          message.error(error instanceof Error ? error.message : TEXT.loadFailed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [strategy]);

  useEffect(() => {
    if (!strategy) {
      return;
    }
    setDraftName(strategy.strategyName);
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
          const element = document.getElementById(`my-strategy-detail-card-${item.chartId}`);
          if (!element) {
            return undefined;
          }
          const rect = element.getBoundingClientRect();
          return { chartCode: item.chartId, top: rect.top, bottom: rect.bottom };
        })
        .filter((item): item is { chartCode: string; top: number; bottom: number } => Boolean(item));
      const nextActiveCodes = resolveActiveRowCodes(cards);
      if (nextActiveCodes.length > 0) {
        setActiveChartCodes(current => (
          current.length === nextActiveCodes.length && current.every((code, index) => code === nextActiveCodes[index])
            ? current
            : nextActiveCodes
        ));
      }
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

  useEffect(() => () => {
    dragCleanupRef.current?.();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  if (!strategy) {
    return <Alert type="warning" showIcon message={TEXT.notFound} description={TEXT.notFoundDescription} />;
  }

  const orderedCharts = draggingChartId && dragOverChartId
    ? (() => {
      const fromIndex = strategy.charts.findIndex(item => item.chartId === draggingChartId);
      const toIndex = strategy.charts.findIndex(item => item.chartId === dragOverChartId);
      return reorderItemsPreview(strategy.charts, fromIndex, toIndex);
    })()
    : strategy.charts;

  const addableCharts = availableCharts.filter(item => !strategy.charts.some(chart => chart.chartId === `${item.chartCode}:${item.component.componentCode}`));

  const scrollToChart = (chartId: string) => {
    const targetIndex = strategy.charts.findIndex(item => item.chartId === chartId);
    const nextActive = targetIndex >= 0
      ? strategy.charts.slice(targetIndex, targetIndex + 3).map(item => item.chartId)
      : [chartId];
    setActiveChartCodes(nextActive);
    document.getElementById(`my-strategy-detail-card-${chartId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const persistStrategy = (patch: Partial<Pick<StrategyRecord, 'strategyName' | 'charts'>>) => {
    updateStrategy(strategy.strategyId, patch, 'personal');
    const nextStrategy = getMyStrategy(strategy.strategyId);
    if (nextStrategy) {
      setStrategy(nextStrategy);
    }
  };

  const saveInfo = () => {
    const trimmedName = draftName.trim();
    if (!trimmedName) {
      message.warning(TEXT.namePlaceholder);
      return;
    }
    persistStrategy({ strategyName: trimmedName });
    message.success(TEXT.updated);
  };

  const removeChartFromStrategy = (chartId: string) => {
    if (strategy.charts.length <= 1) {
      message.warning(TEXT.chartRequired);
      return;
    }
    persistStrategy({ charts: strategy.charts.filter(item => item.chartId !== chartId) });
    message.success(TEXT.updated);
  };

  const toggleAddChart = (chartId: string) => {
    setAddSelectedChartIds(current => (
      current.includes(chartId)
        ? current.filter(item => item !== chartId)
        : [...current, chartId]
    ));
  };

  const confirmAddCharts = () => {
    if (addSelectedChartIds.length === 0) {
      message.warning(TEXT.chartRequired);
      return;
    }
    const nextCharts = addableCharts
      .filter(item => addSelectedChartIds.includes(`${item.chartCode}:${item.component.componentCode}`))
      .map(toStrategyChartSnapshot);
    persistStrategy({ charts: [...strategy.charts, ...nextCharts] });
    setAddChartOpen(false);
    setAddSelectedChartIds([]);
    message.success(TEXT.updated);
  };

  const finishChartDrag = () => {
    const sourceId = draggingChartIdRef.current;
    const targetId = dragOverChartIdRef.current;
    if (sourceId && targetId && sourceId !== targetId) {
      const fromIndex = strategy.charts.findIndex(item => item.chartId === sourceId);
      const toIndex = strategy.charts.findIndex(item => item.chartId === targetId);
      persistStrategy({ charts: reorderItemsPreview(strategy.charts, fromIndex, toIndex) });
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

  const startChartDrag = (event: ReactMouseEvent<HTMLElement>, chartId: string) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    dragCleanupRef.current?.();
    setDraggingChartId(chartId);
    setDragOverChartId(undefined);
    draggingChartIdRef.current = chartId;
    dragOverChartIdRef.current = undefined;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const targetId = resolveClosestSortIdFromPoint(moveEvent.clientX, moveEvent.clientY, 'data-strategy-sort-id');
      if (!targetId || targetId === draggingChartIdRef.current) {
        return;
      }
      if (dragOverChartIdRef.current !== targetId) {
        dragOverChartIdRef.current = targetId;
        setDragOverChartId(targetId);
      }
    };

    const handleMouseUp = () => finishChartDrag();

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  };

  const handleSortCardMouseDown = (event: ReactMouseEvent<HTMLElement>, chartId: string) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }
    startChartDrag(event, chartId);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <Space size={12}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-strategy')}>
              {TEXT.back}
            </Button>
            <h2 className="page-title" style={{ marginBottom: 0 }}>{TEXT.title}</h2>
          </Space>
          <div className="page-subtitle">{TEXT.detailFallback}</div>
        </div>
        <Space wrap size={12}>
          <Button icon={<PlusOutlined />} onClick={() => setAddChartOpen(true)}>
            {TEXT.addChart}
          </Button>
          <Button onClick={saveInfo}>{TEXT.saveInfo}</Button>
        </Space>
      </div>

      <div className="panel-card strategy-config-summary strategy-info-panel">
        <div className="strategy-info-compact">
          <div className="strategy-info-fields">
            <div className="strategy-info-row">
              <span className="strategy-selection-title">{TEXT.strategyName}</span>
              <Input
                value={draftName}
                placeholder={TEXT.namePlaceholder}
                onChange={event => setDraftName(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {orderedCharts.length > 0 ? (
            <div className="favorites-board-grid public-chart-grid">
              {orderedCharts.map(chart => (
                <article
                  key={chart.chartId}
                  id={`my-strategy-detail-card-${chart.chartId}`}
                  data-strategy-sort-id={chart.chartId}
                  className={`panel-card favorites-board-card public-board-card strategy-sort-card${draggingChartId === chart.chartId ? ' strategy-sort-card-dragging' : ''}${dragOverChartId === chart.chartId && draggingChartId !== chart.chartId ? ' strategy-sort-card-drop-target' : ''}`}
                  onMouseDown={event => handleSortCardMouseDown(event, chart.chartId)}
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
                      <Button danger onClick={() => removeChartFromStrategy(chart.chartId)}>
                        {TEXT.removeFromStrategy}
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

      <StrategyChartSelectorModal
        open={addChartOpen}
        title={TEXT.addChartTitle}
        charts={addableCharts}
        selectedChartIds={addSelectedChartIds}
        confirmText={TEXT.completeSelect}
        confirmDisabled={addSelectedChartIds.length === 0}
        onToggle={toggleAddChart}
        onConfirm={confirmAddCharts}
        onCancel={() => {
          setAddChartOpen(false);
          setAddSelectedChartIds([]);
        }}
      />
    </div>
  );
}

export default function MyStrategy() {
  const params = useParams();
  return params.strategyId ? <MyStrategyDetail /> : <MyStrategyOverview />;
}
