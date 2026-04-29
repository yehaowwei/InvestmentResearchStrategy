import {
  ArrowLeftOutlined,
  DeleteOutlined,
  ExpandOutlined,
  FolderOpenOutlined,
  HolderOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined
} from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Select, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import ChartContainer from '../components/ChartContainer';
import ChartRendererCore from '../components/ChartRendererCore';
import StrategyChartSelectorModal from './strategy/StrategyChartSelectorModal';
import type { ChartCatalogItem, ChartPreview } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
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
  create: '\u65b0\u589e\u7b56\u7565',
  createTitle: '\u65b0\u5efa\u7b56\u7565',
  saveInfo: '\u4fdd\u5b58\u4fe1\u606f',
  strategyName: '\u7b56\u7565\u540d\u79f0',
  availableCharts: '\u53ef\u9009\u6307\u6807',
  selectedCharts: '\u5df2\u9009\u6307\u6807',
  namePlaceholder: '\u8f93\u5165\u7b56\u7565\u540d\u79f0',
  searchPlaceholder: '\u641c\u7d22\u6211\u7684\u7b56\u7565\u6216\u6307\u6807\u540d\u79f0',
  open: '\u8fdb\u5165\u7b56\u7565',
  delete: '\u5220\u9664',
  deleteConfirm: '\u786e\u8ba4\u5220\u9664\u5f53\u524d\u6211\u7684\u7b56\u7565\u5417\uff1f',
  confirm: '\u786e\u8ba4',
  cancel: '\u53d6\u6d88',
  countSuffix: '\u4e2a\u6307\u6807',
  noPreview: '\u5f53\u524d\u7b56\u7565\u6682\u65e0\u9884\u89c8',
  noStrategy: '\u8fd8\u6ca1\u6709\u6211\u7684\u7b56\u7565',
  toc: '\u5bfc\u822a',
  notFound: '\u672a\u627e\u5230\u6211\u7684\u7b56\u7565',
  notFoundDescription: '\u8fd9\u4e2a\u7b56\u7565\u53ef\u80fd\u5df2\u7ecf\u88ab\u5220\u9664\u3002',
  back: '\u8fd4\u56de\u6211\u7684\u7b56\u7565',
  enlarge: '\u653e\u5927\u67e5\u770b',
  chartDetail: '\u6307\u6807\u8be6\u60c5',
  noChartPreview: '\u5f53\u524d\u6307\u6807\u6682\u65e0\u9884\u89c8',
  noCharts: '\u5f53\u524d\u7b56\u7565\u8fd8\u6ca1\u6709\u6307\u6807',
  deleteFromStrategy: '\u5220\u9664',
  deleteChartConfirm: '\u786e\u8ba4\u5220\u9664\u5f53\u524d\u6307\u6807\u5417\uff1f',
  addToStrategy: '\u52a0\u5165',
  chartRequired: '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u6307\u6807',
  addChart: '\u65b0\u589e\u6307\u6807',
  addChartTitle: '\u9009\u62e9\u8981\u52a0\u5165\u7684\u6307\u6807',
  completeSelect: '\u9009\u62e9\u5b8c\u6210',
  aiTitle: 'AI\u7b56\u7565\u52a9\u624b',
  aiPlaceholder: '\u4f8b\u5982\uff1a\u5e2e\u6211\u603b\u7ed3\u8fd9\u4e24\u4e2a\u6307\u6807\u6700\u8fd1\u53d8\u5316\uff0c\u6216\u8005\u8fd9\u4e2a\u7b56\u7565\u4e3b\u8981\u5728\u770b\u4ec0\u4e48\uff1f',
  aiSend: '\u53d1\u9001',
  aiReset: '\u65b0\u5efa\u5bf9\u8bdd',
  aiHistory: '\u5386\u53f2\u5bf9\u8bdd',
  aiNoHistory: '\u6682\u65e0\u5386\u53f2\u5bf9\u8bdd',
  aiHistoryTitle: '\u5386\u53f2\u5bf9\u8bdd',
  aiDeleteHistory: '\u5220\u9664\u5bf9\u8bdd',
  aiDeleteHistoryConfirm: '\u786e\u8ba4\u5220\u9664\u8fd9\u6761\u5386\u53f2\u5bf9\u8bdd\u5417\uff1f',
  aiUntitled: '\u7b56\u7565\u89e3\u8bfb\u5bf9\u8bdd',
  aiGreeting: '\u6211\u4f1a\u7ed3\u5408\u5f53\u524d\u7b56\u7565\u91cc\u7684\u6307\u6807\uff0c\u5e2e\u4f60\u505a\u7b80\u6d01\u7684\u7b56\u7565\u89e3\u8bfb\u548c\u6307\u6807\u8bf4\u660e\u3002',
};

interface StrategyAiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface StrategyAiConversation {
  id: string;
  title: string;
  messages: StrategyAiMessage[];
  createdAt: string;
  updatedAt: string;
}

const STRATEGY_AI_HISTORY_STORAGE_KEY = 'bi-strategy-ai-history-v1';

function createInitialAiMessages(seed: string): StrategyAiMessage[] {
  return [{ id: `assistant-${seed}`, role: 'assistant', content: TEXT.aiGreeting }];
}

function createAiConversation(): StrategyAiConversation {
  const now = new Date().toISOString();
  const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    title: TEXT.aiReset,
    messages: createInitialAiMessages(id),
    createdAt: now,
    updatedAt: now
  };
}

function resolveAiConversationTitle(messages: StrategyAiMessage[]) {
  const firstUserMessage = messages.find(item => item.role === 'user' && item.content.trim());
  if (!firstUserMessage) {
    return TEXT.aiReset;
  }
  const normalized = firstUserMessage.content
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(请|帮我|麻烦|你好|您好)[，,。.\s]*/u, '')
    .replace(/[？?。.!！]+$/u, '');
  const title = normalized || TEXT.aiUntitled;
  return title.length > 18 ? `${title.slice(0, 18)}...` : title;
}

function readAiHistoryMap(): Record<string, StrategyAiConversation[]> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STRATEGY_AI_HISTORY_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, StrategyAiConversation[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAiHistoryMap(historyMap: Record<string, StrategyAiConversation[]>) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STRATEGY_AI_HISTORY_STORAGE_KEY, JSON.stringify(historyMap));
}

function readStrategyAiConversations(strategyId?: string) {
  if (!strategyId) {
    return [];
  }
  return (readAiHistoryMap()[strategyId] ?? [])
    .filter(item => Array.isArray(item.messages) && item.messages.length > 0)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20);
}

function writeStrategyAiConversations(strategyId: string | undefined, conversations: StrategyAiConversation[]) {
  if (!strategyId) {
    return;
  }
  const historyMap = readAiHistoryMap();
  historyMap[strategyId] = conversations
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 20);
  writeAiHistoryMap(historyMap);
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) {
      return undefined;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function formatSummaryNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2
  }).format(value);
}

function buildRecentSummaryFromPreview(chart: StrategyChartSnapshot, preview?: ChartPreview) {
  const metrics = chart.dslConfig.queryDsl.metrics ?? [];
  const dimensions = chart.dslConfig.queryDsl.dimensionFields ?? [];
  const metric = metrics[0];
  if (!preview || !metric) {
    return `${chart.componentTitle}\u5f53\u524d\u53ef\u7528\u4e8e\u89c2\u5bdf\u8be5\u6307\u6807\u7684\u9636\u6bb5\u53d8\u5316\u3002`;
  }

  const metricFieldCode = metric.fieldCode;
  const dimensionFieldCode = dimensions[0];
  const points = (preview.rows ?? [])
    .map((row, index) => {
      const value = toFiniteNumber(row[metricFieldCode]);
      if (value == null) {
        return undefined;
      }
      const labelRaw = dimensionFieldCode ? row[dimensionFieldCode] : undefined;
      return {
        label: String(labelRaw ?? `\u7b2c${index + 1}\u671f`),
        value
      };
    })
    .filter((item): item is { label: string; value: number } => Boolean(item));

  if (points.length < 2) {
    return `${chart.componentTitle}\u5f53\u524d\u6837\u672c\u8f83\u5c11\uff0c\u9002\u5408\u7ed3\u5408\u540e\u7eed\u66f4\u65b0\u7ee7\u7eed\u89c2\u5bdf\u3002`;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const latestDelta = last.value - prev.value;
  const latestTrend = latestDelta > 0
    ? '\u8f83\u4e0a\u4e00\u671f\u56de\u5347'
    : latestDelta < 0
      ? '\u8f83\u4e0a\u4e00\u671f\u56de\u843d'
      : '\u4e0e\u4e0a\u4e00\u671f\u57fa\u672c\u6301\u5e73';

  let continuity = '';
  if (points.length >= 3) {
    const prev2 = points[points.length - 3];
    const prevDelta = prev.value - prev2.value;
    if (latestDelta > 0 && prevDelta > 0) {
      continuity = '\u6700\u8fd1\u4e24\u671f\u8fde\u7eed\u56de\u5347';
    } else if (latestDelta < 0 && prevDelta < 0) {
      continuity = '\u6700\u8fd1\u4e24\u671f\u8fde\u7eed\u56de\u843d';
    } else if ((latestDelta > 0 && prevDelta < 0) || (latestDelta < 0 && prevDelta > 0)) {
      continuity = '\u6700\u8fd1\u4e24\u671f\u6709\u4e00\u5b9a\u53cd\u590d';
    }
  }

  const latestValue = `${last.label}\u4e3a${formatSummaryNumber(last.value)}`;
  const body = continuity
    ? `${latestValue}\uff0c${latestTrend}\uff0c${continuity}\u3002`
    : `${latestValue}\uff0c${latestTrend}\u3002`;
  return `${chart.componentTitle}\uff1a${body}`;
}

function buildIndicatorMeaning(title: string) {
  if (title.includes('\u5e02\u573a\u878d\u8d44\u4f59\u989d\u53d8\u5316')) {
    return '\u8fd9\u4e2a\u6307\u6807\u4e3b\u8981\u770b\u5e02\u573a\u6574\u4f53\u878d\u8d44\u8d44\u91d1\u7684\u589e\u51cf\u8282\u594f\uff0c\u9002\u5408\u89c2\u5bdf\u6d41\u52a8\u6027\u53d8\u5316\u662f\u5426\u5728\u52a0\u901f\u6216\u653e\u7f13\u3002';
  }
  if (title.includes('\u5206\u677f\u5757\u878d\u8d44\u4f59\u989d\u5468\u5ea6\u53d8\u5316')) {
    return '\u8fd9\u4e2a\u6307\u6807\u4e3b\u8981\u770b\u878d\u8d44\u8d44\u91d1\u5728\u4e0d\u540c\u677f\u5757\u4e4b\u95f4\u7684\u5206\u5e03\u548c\u5207\u6362\uff0c\u9002\u5408\u89c2\u5bdf\u7ed3\u6784\u5206\u5316\u3002';
  }
  if (title.includes('\u80a1\u6743\u98ce\u9669\u6ea2\u4ef7')) {
    return '\u8fd9\u4e2a\u6307\u6807\u4e3b\u8981\u7528\u6765\u89c2\u5bdf\u6743\u76ca\u8d44\u4ea7\u76f8\u5bf9\u65e0\u98ce\u9669\u5229\u7387\u7684\u5438\u5f15\u529b\u53d8\u5316\u3002';
  }
  return '\u8fd9\u4e2a\u6307\u6807\u4e3b\u8981\u53cd\u6620\u8be5\u7b56\u7565\u6240\u5173\u6ce8\u5e02\u573a\u72b6\u6001\u7684\u9636\u6bb5\u6027\u53d8\u5316\u3002';
}

function buildAiReply(
  strategyName: string,
  prompt: string,
  charts: StrategyChartSnapshot[],
  previewMap: Record<string, ChartPreview>
) {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const summaries = charts.slice(0, 4).map(chart => buildRecentSummaryFromPreview(chart, previewMap[chart.chartId]));
  const meanings = charts.slice(0, 4).map(chart => `${chart.componentTitle}\uff1a${buildIndicatorMeaning(chart.componentTitle)}`);

  if (normalizedPrompt.includes('\u770b\u4ec0\u4e48') || normalizedPrompt.includes('\u6307\u6807') || normalizedPrompt.includes('\u4f5c\u7528')) {
    return `\u8fd9\u4e2a\u7b56\u7565\u5f53\u524d\u4e3b\u8981\u56f4\u7ed5\u4ee5\u4e0b\u6307\u6807\u5c55\u5f00\uff1a\n${meanings.join('\n')}`;
  }

  if (normalizedPrompt.includes('\u603b\u7ed3') || normalizedPrompt.includes('\u53d8\u5316') || normalizedPrompt.includes('\u89e3\u8bfb') || normalizedPrompt.includes('\u6700\u8fd1')) {
    return `\u6211\u7ed3\u5408\u201c${strategyName}\u201d\u91cc\u7684\u6307\u6807\uff0c\u7ed9\u4f60\u505a\u4e00\u4e2a\u7b80\u6d01\u89e3\u8bfb\uff1a\n${summaries.join('\n')}`;
  }

  return `\u5f53\u524d\u8fd9\u4e2a\u7b56\u7565\u662f\u201c${strategyName}\u201d\u3002\n${meanings.join('\n')}\n\n\u5982\u679c\u4f60\u60f3\u770b\u6700\u8fd1\u53d8\u5316\uff0c\u6211\u4e5f\u53ef\u4ee5\u7ee7\u7eed\u6839\u636e\u6307\u6807\u6570\u636e\u505a\u9010\u9879\u89e3\u8bfb\u3002`;
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


function MyStrategyOverview() {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyRecord[]>(listMyStrategies());
  const [searchKeyword, setSearchKeyword] = useState('');
  const [previewMap, setPreviewMap] = useState<Record<string, ChartPreview>>({});
  const [activeChartMap, setActiveChartMap] = useState<Record<string, string>>({});
  const [activeStrategyIds, setActiveStrategyIds] = useState<string[]>([]);
  const [expandedChart, setExpandedChart] = useState<StrategyChartSnapshot>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSelectedChartIds, setCreateSelectedChartIds] = useState<string[]>([]);
  const [catalogCharts, setCatalogCharts] = useState<ChartCatalogItem[]>([]);
  const [availableCharts, setAvailableCharts] = useState<ChartRuntimeCard[]>([]);
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

  const orderedStrategies = filteredStrategies;

  const selectableCharts = useMemo(() => availableCharts, [availableCharts]);

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
        if (dragOverStrategyIdRef.current !== undefined) {
          dragOverStrategyIdRef.current = undefined;
          setDragOverStrategyId(undefined);
        }
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{TEXT.title}</h2>
        </div>
        <Space wrap size={12}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {TEXT.create}
          </Button>
        </Space>
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
          {orderedStrategies.length > 0 ? (
            <div className="favorites-board-grid strategy-center-grid drag-sort-grid">
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
                  >
                    <div className="favorites-board-card-head strategy-overview-head">
                      <div>
                        <h3 className="favorites-board-title">{strategy.strategyName}</h3>
                        <div className="favorites-board-meta">
                          <span>{strategy.charts.length} {TEXT.countSuffix}</span>
                        </div>
                      </div>
                      <div className="favorites-card-actions public-chart-card-actions">
                          <Button
                            className="thumbnail-drag-button"
                            icon={<HolderOutlined />}
                            title="拖拽排序"
                            aria-label="拖拽排序"
                            onMouseDown={event => startStrategyDrag(event, strategy.strategyId)}
                        >
                          拖拽
                        </Button>
                        <Button icon={<ExpandOutlined />} onClick={() => activeChart && setExpandedChart(activeChart)}>
                          {TEXT.enlarge}
                        </Button>
                        <Button icon={<FolderOpenOutlined />} onClick={() => navigate(`/my-strategy/${strategy.strategyId}`)}>
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

function MyStrategyDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const [strategy, setStrategy] = useState<StrategyRecord | undefined>(() => getMyStrategy(params.strategyId));
  const [previewMap, setPreviewMap] = useState<Record<string, ChartPreview>>({});
  const [expandedChart, setExpandedChart] = useState<StrategyChartSnapshot>();
  const [draftName, setDraftName] = useState('');
  const [catalogCharts, setCatalogCharts] = useState<ChartCatalogItem[]>([]);
  const [availableCharts, setAvailableCharts] = useState<ChartRuntimeCard[]>([]);
  const [addChartOpen, setAddChartOpen] = useState(false);
  const [addSelectedChartIds, setAddSelectedChartIds] = useState<string[]>([]);
  const [aiMessages, setAiMessages] = useState<StrategyAiMessage[]>(createInitialAiMessages('initial'));
  const [aiConversations, setAiConversations] = useState<StrategyAiConversation[]>([]);
  const [activeAiConversationId, setActiveAiConversationId] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [draggingChartId, setDraggingChartId] = useState<string>();
  const [dragOverChartId, setDragOverChartId] = useState<string>();
  const aiMessagesRef = useRef<HTMLDivElement | null>(null);
  const draggingChartIdRef = useRef<string>();
  const dragOverChartIdRef = useRef<string>();
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setStrategy(getMyStrategy(params.strategyId));
  }, [params.strategyId]);

  useEffect(() => {
    const loadedConversations = readStrategyAiConversations(params.strategyId);
    const activeConversation = loadedConversations[0] ?? createAiConversation();
    const nextConversations = loadedConversations.length > 0 ? loadedConversations : [activeConversation];
    setAiConversations(nextConversations);
    setActiveAiConversationId(activeConversation.id);
    setAiMessages(activeConversation.messages);
    setAiInput('');
    writeStrategyAiConversations(params.strategyId, nextConversations);
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

  useEffect(() => () => {
    dragCleanupRef.current?.();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    if (!aiMessagesRef.current) {
      return;
    }
    aiMessagesRef.current.scrollTop = aiMessagesRef.current.scrollHeight;
  }, [aiMessages, aiLoading]);

  if (!strategy) {
    return <Alert type="warning" showIcon message={TEXT.notFound} description={TEXT.notFoundDescription} />;
  }

  const orderedCharts = strategy.charts;

  const addableCharts = availableCharts.filter(item => !strategy.charts.some(chart => chart.chartId === `${item.chartCode}:${item.component.componentCode}`));

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

  const submitAiMessage = () => {
    void submitAiMessageAsync();
  };

  const updateActiveAiMessages = (updater: (current: StrategyAiMessage[]) => StrategyAiMessage[]) => {
    setAiMessages(currentMessages => {
      const nextMessages = updater(currentMessages);
      const now = new Date().toISOString();
      setAiConversations(currentConversations => {
        const activeId = activeAiConversationId || currentConversations[0]?.id || createAiConversation().id;
        const existingConversation = currentConversations.find(item => item.id === activeId);
        const nextConversation: StrategyAiConversation = {
          id: activeId,
          title: resolveAiConversationTitle(nextMessages),
          messages: nextMessages,
          createdAt: existingConversation?.createdAt ?? now,
          updatedAt: now
        };
        const nextConversations = [
          nextConversation,
          ...currentConversations.filter(item => item.id !== activeId)
        ];
        writeStrategyAiConversations(params.strategyId, nextConversations);
        return nextConversations;
      });
      return nextMessages;
    });
  };

  const submitAiMessageAsync = async () => {
    const trimmedInput = aiInput.trim();
    if (!trimmedInput) {
      return;
    }

    const userMessage: StrategyAiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedInput
    };

    updateActiveAiMessages(current => [...current, userMessage]);
    setAiInput('');

    const chartContexts = strategy.charts.slice(0, 4).map(chart => ({
      title: chart.componentTitle,
      summary: buildRecentSummaryFromPreview(chart, previewMap[chart.chartId]),
      meaning: buildIndicatorMeaning(chart.componentTitle)
    }));

    setAiLoading(true);
    const assistantMessageId = `assistant-${Date.now()}`;
    updateActiveAiMessages(current => [...current, {
      id: assistantMessageId,
      role: 'assistant',
      content: ''
    }]);

    try {
      await api.strategyAiChatStream({
        strategyName: strategy.strategyName,
        prompt: trimmedInput,
        charts: chartContexts
      }, chunk => {
        updateActiveAiMessages(current => current.map(item => (
          item.id === assistantMessageId
            ? { ...item, content: item.content + chunk }
            : item
        )));
      });
    } catch (error) {
      console.error(error);
      updateActiveAiMessages(current => current.map(item => (
        item.id === assistantMessageId
          ? { ...item, content: buildAiReply(strategy.strategyName, trimmedInput, strategy.charts, previewMap) }
          : item
      )));
    } finally {
      setAiLoading(false);
    }
  };

  const resetAiConversation = () => {
    const nextConversation = createAiConversation();
    const nextConversations = [nextConversation, ...aiConversations];
    setAiConversations(nextConversations);
    setActiveAiConversationId(nextConversation.id);
    setAiMessages(nextConversation.messages);
    setAiInput('');
    writeStrategyAiConversations(params.strategyId, nextConversations);
  };

  const restoreAiConversation = (conversation: StrategyAiConversation) => {
    setActiveAiConversationId(conversation.id);
    setAiMessages(conversation.messages);
    setAiInput('');
  };

  const deleteAiConversation = (conversationId: string) => {
    const remainingConversations = aiConversations.filter(item => item.id !== conversationId);
    const nextConversations = remainingConversations.length > 0 ? remainingConversations : [createAiConversation()];
    const nextActiveConversation = conversationId === activeAiConversationId
      ? nextConversations[0]
      : nextConversations.find(item => item.id === activeAiConversationId) ?? nextConversations[0];
    setAiConversations(nextConversations);
    setActiveAiConversationId(nextActiveConversation.id);
    setAiMessages(nextActiveConversation.messages);
    setAiInput('');
    writeStrategyAiConversations(params.strategyId, nextConversations);
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
        if (dragOverChartIdRef.current !== undefined) {
          dragOverChartIdRef.current = undefined;
          setDragOverChartId(undefined);
        }
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

  return (
    <div>
      <div className="page-header">
        <div>
          <Space size={12}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/my-strategy')}>
              {TEXT.back}
            </Button>
            <h2 className="page-title" style={{ marginBottom: 0 }}>{draftName || TEXT.title}</h2>
          </Space>
        </div>
        <div className="strategy-detail-header-actions">
          <Input
            className="strategy-header-name-input"
            value={draftName}
            placeholder={TEXT.namePlaceholder}
            onChange={event => setDraftName(event.target.value)}
          />
          <Button icon={<PlusOutlined />} onClick={() => setAddChartOpen(true)}>
            {TEXT.addChart}
          </Button>
          <Button onClick={saveInfo}>{TEXT.saveInfo}</Button>
        </div>
      </div>

      <div className="strategy-detail-shell">
        <div className="strategy-detail-main">
          {orderedCharts.length > 0 ? (
            <div className="favorites-board-grid strategy-detail-grid drag-sort-grid">
              {orderedCharts.map(chart => (
                <article
                  key={chart.chartId}
                  id={`my-strategy-detail-card-${chart.chartId}`}
                  data-strategy-sort-id={chart.chartId}
                  className={`panel-card favorites-board-card strategy-indicator-card strategy-sort-card${draggingChartId === chart.chartId ? ' strategy-sort-card-dragging' : ''}${dragOverChartId === chart.chartId && draggingChartId !== chart.chartId ? ' strategy-sort-card-drop-target' : ''}`}
                >
                  <div className="favorites-board-card-head">
                    <div>
                      <h3 className="favorites-board-title">{chart.componentTitle}</h3>
                      <div className="favorites-board-meta">
                        <span>{chart.chartName}</span>
                      </div>
                    </div>
                    <div className="favorites-card-actions public-chart-card-actions">
                      <Button
                        className="thumbnail-drag-button"
                        icon={<HolderOutlined />}
                        title="拖拽排序"
                        aria-label="拖拽排序"
                        onMouseDown={event => startChartDrag(event, chart.chartId)}
                      >
                        拖拽
                      </Button>
                      <Button icon={<ExpandOutlined />} onClick={() => setExpandedChart(chart)}>
                        {TEXT.enlarge}
                      </Button>
                      <Popconfirm
                        title={TEXT.deleteChartConfirm}
                        okText={TEXT.confirm}
                        cancelText={TEXT.cancel}
                        onConfirm={() => removeChartFromStrategy(chart.chartId)}
                      >
                        <Button danger>
                          {TEXT.deleteFromStrategy}
                        </Button>
                      </Popconfirm>
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
        <aside className="panel-card strategy-ai-panel">
          <div className="strategy-ai-panel-head">
            <div className="strategy-ai-panel-title">
              <RobotOutlined />
              <span>{TEXT.aiTitle}</span>
            </div>
            <div className="strategy-ai-panel-actions">
              <Select
                size="small"
                className="strategy-ai-history-select"
                value={activeAiConversationId || undefined}
                placeholder={TEXT.aiHistory}
                popupMatchSelectWidth={false}
                optionLabelProp="title"
                options={aiConversations.map(conversation => ({
                  value: conversation.id,
                  title: conversation.title,
                  label: (
                    <span className="strategy-ai-history-option">
                      <span className="strategy-ai-history-option-main">
                        <span className="strategy-ai-history-option-title">{conversation.title}</span>
                        <span className="strategy-ai-history-option-time">
                          {new Date(conversation.updatedAt).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </span>
                      <Popconfirm
                        title={TEXT.aiDeleteHistoryConfirm}
                        okText={TEXT.confirm}
                        cancelText={TEXT.cancel}
                        onConfirm={event => {
                          event?.stopPropagation();
                          deleteAiConversation(conversation.id);
                        }}
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          title={TEXT.aiDeleteHistory}
                          aria-label={TEXT.aiDeleteHistory}
                          disabled={aiLoading}
                          onMouseDown={event => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={event => {
                            event.stopPropagation();
                          }}
                        />
                      </Popconfirm>
                    </span>
                  )
                }))}
                onChange={value => {
                  const conversation = aiConversations.find(item => item.id === value);
                  if (conversation) {
                    restoreAiConversation(conversation);
                  }
                }}
              />
              <Button size="small" onClick={resetAiConversation}>{TEXT.aiReset}</Button>
            </div>
          </div>
          <div className="strategy-ai-messages" ref={aiMessagesRef}>
            {aiMessages.map(item => (
              <div key={item.id} className={`strategy-ai-message strategy-ai-message-${item.role}`}>
                <div className="strategy-ai-bubble">{item.content}</div>
              </div>
            ))}
          </div>
          <div className="strategy-ai-compose">
            <Input.TextArea
              value={aiInput}
              placeholder={TEXT.aiPlaceholder}
              autoSize={{ minRows: 3, maxRows: 5 }}
              disabled={aiLoading}
              onChange={event => setAiInput(event.target.value)}
              onPressEnter={event => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  submitAiMessage();
                }
              }}
            />
            <div className="strategy-ai-compose-actions">
              <Button type="primary" icon={<SendOutlined />} loading={aiLoading} onClick={submitAiMessage}>
                {TEXT.aiSend}
              </Button>
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

