import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EditOutlined,
  ExpandOutlined,
  HolderOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Space, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import AppSearchInput from '../components/AppSearchInput';
import ChartRendererCore from '../components/ChartRendererCore';
import type { ChartCatalogItem } from '../types/dashboard';
import { normalizeDisplayText } from '../utils/dashboard';
import { buildChartRuntimeCards, type ChartRuntimeCard } from '../utils/chartLibrary';
import {
  createStrategy,
  deleteStrategy,
  listStrategies,
  strategyChangeEventName,
  toStrategyChartSnapshot,
  updateStrategy
} from '../utils/strategies';
import {
  normalizeSearchKeyword,
  reorderItemsPreview,
  resolveActiveRowCodes,
  resolveClosestSortIdFromPoint,
  scrollContainerItemToCenter
} from './indicatorPageNavigation';
import StrategyChartSelectorModal from './strategy/StrategyChartSelectorModal';

const TEXT = {
  loadFailed: '\u7b56\u7565\u914d\u7f6e\u52a0\u8f7d\u5931\u8d25',
  created: '\u7b56\u7565\u5df2\u521b\u5efa',
  draftSaved: '\u914d\u7f6e\u8349\u7a3f\u5df2\u4fdd\u5b58',
  publishFailed: '\u53d1\u5e03\u5931\u8d25',
  saveFailed: '\u4fdd\u5b58\u5931\u8d25',
  chartRequired: '\u8bf7\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u6307\u6807',
  title: '\u7b56\u7565\u914d\u7f6e',
  backCenter: '\u8fd4\u56de\u7b56\u7565\u4e2d\u5fc3',
  backMine: '\u8fd4\u56de\u6211\u7684\u7b56\u7565',
  save: '\u4fdd\u5b58',
  publish: '\u53d1\u5e03',
  strategyName: '\u7b56\u7565\u540d\u79f0',
  namePlaceholder: '\u8f93\u5165\u7b56\u7565\u540d\u79f0',
  selectedCharts: '\u5df2\u9009\u6307\u6807',
  countSuffix: '\u4e2a\u6307\u6807',
  searchDraftPlaceholder: '\u641c\u7d22\u7b56\u7565\u540d\u79f0\u6216\u6307\u6807\u540d\u79f0',
  removeFromStrategy: '\u79fb\u51fa',
  loadingCharts: '\u6307\u6807\u52a0\u8f7d\u4e2d',
  noPreview: '\u5f53\u524d\u6307\u6807\u6682\u65e0\u9884\u89c8',
  noSelectedChart: '\u8fd8\u6ca1\u6709\u9009\u62e9\u6307\u6807',
  unsaved: '\u672a\u8bb0\u5f55',
  unpublished: '\u672a\u53d1\u5e03',
  saveTime: '\u4fdd\u5b58\u65f6\u95f4',
  publishTime: '\u4e0a\u6b21\u53d1\u5e03\u65f6\u95f4',
  open: '\u8fdb\u5165\u914d\u7f6e',
  delete: '\u5220\u9664',
  deleteConfirm: '\u786e\u8ba4\u5220\u9664\u8fd9\u4e2a\u7b56\u7565\u914d\u7f6e\u5417\uff1f',
  createDraft: '\u65b0\u5efa\u7b56\u7565',
  noDraft: '\u8fd8\u6ca1\u6709\u7b56\u7565\u914d\u7f6e',
  detailFallback: '\u8fd9\u91cc\u662f IT \u7ef4\u62a4\u89c6\u89d2\uff0c\u53ef\u4ee5\u5bf9\u5355\u4e2a\u7b56\u7565\u8fdb\u884c\u547d\u540d\u3001\u65b0\u589e\u3001\u79fb\u9664\u548c\u76f4\u63a5\u62d6\u62fd\u6392\u5e8f\u3002',
  notFound: '\u672a\u627e\u5230\u8fd9\u4e2a\u7b56\u7565\u914d\u7f6e',
  notFoundDescription: '\u8fd9\u4e2a\u7b56\u7565\u914d\u7f6e\u53ef\u80fd\u5df2\u88ab\u5220\u9664\u3002',
  toc: '\u7b56\u7565\u914d\u7f6e',
  draftLabel: '\u914d\u7f6e\u4e2d',
  cancel: '\u53d6\u6d88',
  completeSelect: '\u9009\u62e9\u5b8c\u6210',
  addChart: '\u65b0\u589e\u6307\u6807',
  addChartTitle: '\u9009\u62e9\u8981\u52a0\u5165\u7684\u6307\u6807',
  chartDetail: '\u6307\u6807\u8be6\u60c5'
} as const;

type StrategyConfigScope = 'personal' | 'public';

type StrategyConfigDraft = {
  draftId: string;
  strategyId?: string;
  strategyName: string;
  selectedChartIds: string[];
  order: number;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
  publishedAt?: string;
};

const STORAGE_PREFIX = 'strategy-dashboard-config-drafts';
const CHANGE_EVENT = 'strategy-dashboard-config-drafts-changed';

function storageKey(scope: StrategyConfigScope) {
  return `${STORAGE_PREFIX}:${scope}`;
}

function formatDateTime(value?: string) {
  if (!value) {
    return TEXT.unsaved;
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function normalizeDraft(draft: StrategyConfigDraft, fallbackOrder: number): StrategyConfigDraft {
  return {
    draftId: draft.draftId,
    strategyId: draft.strategyId,
    strategyName: normalizeDisplayText(draft.strategyName, draft.draftId),
    selectedChartIds: Array.isArray(draft.selectedChartIds) ? draft.selectedChartIds.filter(item => typeof item === 'string') : [],
    order: Number.isFinite(draft.order) ? draft.order : fallbackOrder,
    createdAt: draft.createdAt || new Date().toISOString(),
    updatedAt: draft.updatedAt || draft.createdAt || new Date().toISOString(),
    savedAt: draft.savedAt,
    publishedAt: draft.publishedAt
  };
}

function isLinkedDraft(scope: StrategyConfigScope, draft: StrategyConfigDraft) {
  return draft.draftId.startsWith(`strategy-config-linked-${scope}-`);
}

function syncDraftsWithStrategies(scope: StrategyConfigScope, drafts: StrategyConfigDraft[]) {
  const strategies = listStrategies(scope);
  const filteredDrafts = drafts
    .filter(draft => !draft.strategyId || strategies.some(strategy => strategy.strategyId === draft.strategyId));

  const dedupedDrafts: StrategyConfigDraft[] = [];
  const strategyDraftMap = new Map<string, number>();

  filteredDrafts.forEach(draft => {
    if (!draft.strategyId) {
      dedupedDrafts.push(draft);
      return;
    }

    const existingIndex = strategyDraftMap.get(draft.strategyId);
    if (existingIndex == null) {
      strategyDraftMap.set(draft.strategyId, dedupedDrafts.length);
      dedupedDrafts.push(draft);
      return;
    }

    const existingDraft = dedupedDrafts[existingIndex];
    const existingIsLinked = isLinkedDraft(scope, existingDraft);
    const incomingIsLinked = isLinkedDraft(scope, draft);

    if (existingIsLinked && !incomingIsLinked) {
      dedupedDrafts[existingIndex] = draft;
      return;
    }

    if (existingIsLinked === incomingIsLinked && draft.updatedAt > existingDraft.updatedAt) {
      dedupedDrafts[existingIndex] = draft;
    }
  });

  const linkedStrategyIds = new Set(
    dedupedDrafts
      .map(draft => draft.strategyId)
      .filter((strategyId): strategyId is string => Boolean(strategyId))
  );

  let changed = dedupedDrafts.length !== drafts.length;

  strategies.forEach(strategy => {
    if (linkedStrategyIds.has(strategy.strategyId)) {
      return;
    }
    dedupedDrafts.push({
      draftId: `strategy-config-linked-${scope}-${strategy.strategyId}`,
      strategyId: strategy.strategyId,
      strategyName: strategy.strategyName,
      selectedChartIds: strategy.charts.map(chart => chart.chartId),
      order: dedupedDrafts.length + 1,
      createdAt: strategy.createdAt,
      updatedAt: strategy.updatedAt,
      savedAt: strategy.updatedAt,
      publishedAt: strategy.updatedAt
    });
    changed = true;
  });

  const normalized = dedupedDrafts
    .map((item, index) => normalizeDraft(item, index + 1))
    .sort((a, b) => (a.order - b.order) || a.createdAt.localeCompare(b.createdAt));

  if (changed && typeof window !== 'undefined') {
    window.localStorage.setItem(storageKey(scope), JSON.stringify(normalized));
  }

  return normalized;
}

function listDrafts(scope: StrategyConfigScope) {
  if (typeof window === 'undefined') {
    return [] as StrategyConfigDraft[];
  }
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) {
      return syncDraftsWithStrategies(scope, []);
    }
    const parsed = JSON.parse(raw) as StrategyConfigDraft[];
    if (!Array.isArray(parsed)) {
      return syncDraftsWithStrategies(scope, []);
    }
    const drafts = syncDraftsWithStrategies(scope, parsed);
    return drafts;
  } catch {
    return syncDraftsWithStrategies(scope, []);
  }
}

function writeDrafts(scope: StrategyConfigScope, drafts: StrategyConfigDraft[]) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(storageKey(scope), JSON.stringify(drafts));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function createDraft(scope: StrategyConfigScope, input?: { strategyName?: string; selectedChartIds?: string[] }) {
  const drafts = listDrafts(scope);
  const timestamp = Date.now();
  const now = new Date().toISOString();
  const draft: StrategyConfigDraft = {
    draftId: `strategy-config-${scope}-${timestamp}`,
    strategyName: normalizeDisplayText(input?.strategyName, `\u7b56\u7565${drafts.length + 1}`),
    selectedChartIds: input?.selectedChartIds ?? [],
    order: drafts.length + 1,
    createdAt: now,
    updatedAt: now
  };
  writeDrafts(scope, [...drafts, draft]);
  return draft;
}

function updateDraft(
  scope: StrategyConfigScope,
  draftId: string,
  patch: Partial<Pick<StrategyConfigDraft, 'strategyId' | 'strategyName' | 'selectedChartIds' | 'savedAt' | 'publishedAt' | 'order'>>
) {
  const drafts = listDrafts(scope).map(draft => {
    if (draft.draftId !== draftId) {
      return draft;
    }
    return {
      ...draft,
      strategyId: patch.strategyId ?? draft.strategyId,
      strategyName: patch.strategyName != null ? normalizeDisplayText(patch.strategyName, draft.draftId) : draft.strategyName,
      selectedChartIds: patch.selectedChartIds ?? draft.selectedChartIds,
      order: patch.order ?? draft.order,
      savedAt: patch.savedAt ?? draft.savedAt,
      publishedAt: patch.publishedAt ?? draft.publishedAt,
      updatedAt: new Date().toISOString()
    };
  });
  writeDrafts(scope, drafts);
}

function deleteDraft(scope: StrategyConfigScope, draftId: string) {
  const drafts = listDrafts(scope);
  const targetDraft = drafts.find(draft => draft.draftId === draftId);
  if (targetDraft?.strategyId) {
    deleteStrategy(targetDraft.strategyId, scope);
  }
  const nextDrafts = drafts
    .filter(draft => draft.draftId !== draftId)
    .map((draft, index) => ({ ...draft, order: index + 1 }));
  writeDrafts(scope, nextDrafts);
}

function getDraft(scope: StrategyConfigScope, draftId?: string) {
  if (!draftId) {
    return undefined;
  }
  return listDrafts(scope).find(item => item.draftId === draftId);
}

function matchDraftKeyword(draft: StrategyConfigDraft, cards: ChartRuntimeCard[], keyword: string) {
  if (!keyword) {
    return true;
  }
  const normalizedKeyword = normalizeSearchKeyword(keyword);
  const titlePool = draft.selectedChartIds
    .map(chartId => cards.find(item => `${item.chartCode}:${item.component.componentCode}` === chartId))
    .filter((item): item is ChartRuntimeCard => Boolean(item))
    .map(item => normalizeDisplayText(item.component.dslConfig.visualDsl.title || item.component.title, item.component.componentCode));
  return [draft.strategyName, ...titlePool].some(value => value.toLowerCase().includes(normalizedKeyword));
}

function StrategyConfigOverview(props: {
  scope: StrategyConfigScope;
  backPath: string;
  availableCharts: ChartRuntimeCard[];
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [drafts, setDrafts] = useState<StrategyConfigDraft[]>(() => listDrafts(props.scope));
  const [searchKeyword, setSearchKeyword] = useState('');
  const [activeChartMap, setActiveChartMap] = useState<Record<string, string>>({});
  const [activeDraftIds, setActiveDraftIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSelectedChartIds, setCreateSelectedChartIds] = useState<string[]>([]);
  const [expandedChart, setExpandedChart] = useState<ChartRuntimeCard>();
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const scopeQuery = searchParams.get('scope') === 'my' ? 'my' : undefined;

  const filteredDrafts = useMemo(
    () => drafts.filter(item => matchDraftKeyword(item, props.availableCharts, searchKeyword)),
    [drafts, props.availableCharts, searchKeyword]
  );

  useEffect(() => {
    const sync = () => setDrafts(listDrafts(props.scope));
    const strategyEventName = strategyChangeEventName(props.scope);
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync as EventListener);
    window.addEventListener(strategyEventName, sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync as EventListener);
      window.removeEventListener(strategyEventName, sync as EventListener);
    };
  }, [props.scope]);

  useEffect(() => {
    setActiveChartMap(current => filteredDrafts.reduce<Record<string, string>>((accumulator, draft) => {
      const currentActive = current[draft.draftId];
      accumulator[draft.draftId] = draft.selectedChartIds.includes(currentActive)
        ? currentActive
        : draft.selectedChartIds[0] ?? '';
      return accumulator;
    }, {}));
  }, [filteredDrafts]);

  useEffect(() => {
    if (filteredDrafts.length === 0) {
      setActiveDraftIds([]);
      return;
    }

    const updateActiveDrafts = () => {
      const cards = filteredDrafts
        .map(item => {
          const element = document.getElementById(`strategy-config-card-${item.draftId}`);
          if (!element) {
            return undefined;
          }
          const rect = element.getBoundingClientRect();
          return { chartCode: item.draftId, top: rect.top, bottom: rect.bottom };
        })
        .filter((item): item is { chartCode: string; top: number; bottom: number } => Boolean(item));

      const nextActiveIds = resolveActiveRowCodes(cards);
      if (nextActiveIds.length > 0) {
        setActiveDraftIds(current => (
          current.length === nextActiveIds.length && current.every((code, index) => code === nextActiveIds[index])
            ? current
            : nextActiveIds
        ));
      }
    };

    updateActiveDrafts();
    window.addEventListener('scroll', updateActiveDrafts, { passive: true });
    window.addEventListener('resize', updateActiveDrafts);
    return () => {
      window.removeEventListener('scroll', updateActiveDrafts);
      window.removeEventListener('resize', updateActiveDrafts);
    };
  }, [filteredDrafts]);

  useEffect(() => {
    if (!tocScrollRef.current || activeDraftIds.length === 0) {
      return;
    }
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${activeDraftIds[0]}"]`);
  }, [activeDraftIds]);

  const openDraft = (draftId: string) => {
    const query = scopeQuery ? `?scope=${scopeQuery}&draft=${draftId}` : `?draft=${draftId}`;
    navigate(`/strategy/config${query}`);
  };

  const removeDraftAndRefresh = (draftId: string) => {
    deleteDraft(props.scope, draftId);
    setDrafts(listDrafts(props.scope));
  };

  const scrollToDraft = (draftId: string) => {
    const targetIndex = filteredDrafts.findIndex(item => item.draftId === draftId);
    const nextActive = targetIndex >= 0
      ? filteredDrafts.slice(targetIndex, targetIndex + 3).map(item => item.draftId)
      : [draftId];
    setActiveDraftIds(nextActive);
    document.getElementById(`strategy-config-card-${draftId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleCreateChart = (chartId: string) => {
    setCreateSelectedChartIds(current => (
      current.includes(chartId)
        ? current.filter(item => item !== chartId)
        : [...current, chartId]
    ));
  };

  const createAndOpenDraft = () => {
    if (!createName.trim()) {
      message.warning(TEXT.namePlaceholder);
      return;
    }
    if (createSelectedChartIds.length === 0) {
      message.warning(TEXT.chartRequired);
      return;
    }
    const draft = createDraft(props.scope, {
      strategyName: createName.trim(),
      selectedChartIds: createSelectedChartIds
    });
    const query = scopeQuery ? `?scope=${scopeQuery}&draft=${draft.draftId}` : `?draft=${draft.draftId}`;
    setCreateOpen(false);
    setCreateName('');
    setCreateSelectedChartIds([]);
    navigate(`/strategy/config${query}`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{TEXT.title}</h2>
        </div>
        <Space wrap size={12}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {TEXT.createDraft}
          </Button>
        </Space>
      </div>

      <div className="favorites-filter-nav">
        <AppSearchInput
          allowClear
          placeholder={TEXT.searchDraftPlaceholder}
          className="page-toc-width-search"
          style={{ marginLeft: 'auto' }}
          value={searchKeyword}
          onChange={event => setSearchKeyword(event.target.value)}
        />
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {filteredDrafts.length > 0 ? (
            <div className="favorites-board-grid strategy-center-grid">
              {filteredDrafts.map(draft => {
                const activeChartId = activeChartMap[draft.draftId];
                const activeCard = props.availableCharts.find(item => `${item.chartCode}:${item.component.componentCode}` === activeChartId)
                  ?? props.availableCharts.find(item => draft.selectedChartIds.includes(`${item.chartCode}:${item.component.componentCode}`));

                return (
                  <article
                    key={draft.draftId}
                    id={`strategy-config-card-${draft.draftId}`}
                    className="panel-card favorites-board-card strategy-overview-card"
                  >
                    <div className="favorites-board-card-head strategy-overview-head">
                      <div>
                        <h3 className="favorites-board-title">{draft.strategyName}</h3>
                        <div className="favorites-board-meta">
                          <span>{draft.selectedChartIds.length} {TEXT.countSuffix}</span>
                          <span>{TEXT.draftLabel}</span>
                          <span>{TEXT.saveTime}：{formatDateTime(draft.savedAt)}</span>
                        </div>
                      </div>
                      <div className="favorites-card-actions public-chart-card-actions">
                        <Button icon={<ExpandOutlined />} onClick={() => activeCard && setExpandedChart(activeCard)} disabled={!activeCard}>
                          放大
                        </Button>
                        <Button icon={<EditOutlined />} onClick={() => openDraft(draft.draftId)}>
                          {TEXT.open}
                        </Button>
                        <Popconfirm
                          title={TEXT.deleteConfirm}
                          okText={TEXT.delete}
                          cancelText={TEXT.cancel}
                          onConfirm={() => removeDraftAndRefresh(draft.draftId)}
                        >
                          <Button icon={<DeleteOutlined />} danger>
                            {TEXT.delete}
                          </Button>
                        </Popconfirm>
                      </div>
                    </div>

                    <div className="strategy-chip-list">
                      {draft.selectedChartIds.map(chartId => {
                        const card = props.availableCharts.find(item => `${item.chartCode}:${item.component.componentCode}` === chartId);
                        if (!card) {
                          return null;
                        }
                        return (
                          <button
                            key={chartId}
                            type="button"
                            className={`strategy-chip${chartId === activeChartMap[draft.draftId] ? ' active' : ''}`}
                            onMouseDown={event => {
                              event.preventDefault();
                              event.stopPropagation();
                            }}
                            onClick={() => setActiveChartMap(current => ({ ...current, [draft.draftId]: chartId }))}
                          >
                            {normalizeDisplayText(card.component.dslConfig.visualDsl.title || card.component.title, card.component.componentCode)}
                          </button>
                        );
                      })}
                    </div>

                    <div className="favorites-board-thumb">
                      <div className="library-chart-preview strategy-preview-frame">
                        <div className="library-chart-preview-head">
                          <div className="library-chart-preview-title">
                            {activeCard
                              ? normalizeDisplayText(activeCard.component.dslConfig.visualDsl.title || activeCard.component.title, activeCard.component.componentCode)
                              : TEXT.noSelectedChart}
                          </div>
                        </div>
                        <div className="library-chart-preview-body">
                          {activeCard?.preview ? (
                            <ChartRendererCore
                              component={activeCard.component}
                              preview={activeCard.preview}
                              templateCode={activeCard.component.templateCode}
                              viewMode="chart"
                              editable={false}
                              selected={false}
                              thumbnail
                              compact={false}
                              dense
                            />
                          ) : (
                            <Empty description={draft.selectedChartIds.length > 0 ? TEXT.noPreview : TEXT.noSelectedChart} />
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
              <Empty description={TEXT.noDraft} />
            </div>
          )}
        </div>

        <aside className="panel-card runtime-toc-card">
          <div className="runtime-toc-title">{TEXT.toc}</div>
          <div className="runtime-toc-scroll" ref={tocScrollRef}>
            <div className="runtime-toc-items">
              {filteredDrafts.map(draft => (
                <button
                  key={draft.draftId}
                  type="button"
                  data-chart-code={draft.draftId}
                  className={`runtime-toc-item${activeDraftIds.includes(draft.draftId) ? ' active' : ''}`}
                  onClick={() => scrollToDraft(draft.draftId)}
                >
                  {draft.strategyName}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <StrategyChartSelectorModal
        open={createOpen}
        title={TEXT.createDraft}
        charts={props.availableCharts}
        selectedChartIds={createSelectedChartIds}
        confirmText={TEXT.completeSelect}
        onToggle={toggleCreateChart}
        onConfirm={createAndOpenDraft}
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
        title={expandedChart ? normalizeDisplayText(expandedChart.component.dslConfig.visualDsl.title || expandedChart.component.title, expandedChart.component.componentCode) : TEXT.selectedCharts}
        open={Boolean(expandedChart)}
        footer={null}
        destroyOnHidden
        onCancel={() => setExpandedChart(undefined)}
        width="90vw"
        styles={{ body: { height: '72vh', padding: 16 } }}
      >
        {expandedChart ? (
          <ChartRendererCore
            key={expandedChart.component.componentCode}
            component={expandedChart.component}
            preview={expandedChart.preview}
            templateCode={expandedChart.component.templateCode}
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
    </div>
  );
}

function StrategyConfigEditor(props: {
  scope: StrategyConfigScope;
  draftId: string;
  availableCharts: ChartRuntimeCard[];
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [draft, setDraft] = useState<StrategyConfigDraft | undefined>(() => getDraft(props.scope, props.draftId));
  const [strategyName, setStrategyName] = useState('');
  const [addChartOpen, setAddChartOpen] = useState(false);
  const [addSelectedChartIds, setAddSelectedChartIds] = useState<string[]>([]);
  const [draggingChartId, setDraggingChartId] = useState<string>();
  const [dragOverChartId, setDragOverChartId] = useState<string>();
  const [expandedChart, setExpandedChart] = useState<ChartRuntimeCard>();
  const tocScrollRef = useRef<HTMLDivElement | null>(null);
  const draggingChartIdRef = useRef<string>();
  const dragOverChartIdRef = useRef<string>();
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setDraft(getDraft(props.scope, props.draftId));
  }, [props.draftId, props.scope]);

  useEffect(() => {
    const sync = () => setDraft(getDraft(props.scope, props.draftId));
    const strategyEventName = strategyChangeEventName(props.scope);
    window.addEventListener('storage', sync);
    window.addEventListener(CHANGE_EVENT, sync as EventListener);
    window.addEventListener(strategyEventName, sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CHANGE_EVENT, sync as EventListener);
      window.removeEventListener(strategyEventName, sync as EventListener);
    };
  }, [props.draftId, props.scope]);

  useEffect(() => {
    if (!draft) {
      return;
    }
    setStrategyName(draft.strategyName);
  }, [draft]);

  useEffect(() => () => {
    dragCleanupRef.current?.();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  if (!draft) {
    return <Alert type="warning" showIcon message={TEXT.notFound} description={TEXT.notFoundDescription} />;
  }

  const selectedCharts = draft.selectedChartIds
    .map(chartId => props.availableCharts.find(item => `${item.chartCode}:${item.component.componentCode}` === chartId))
    .filter((item): item is ChartRuntimeCard => Boolean(item));

  const orderedSelectedCharts = selectedCharts;

  const addableCharts = props.availableCharts.filter(item => !draft.selectedChartIds.includes(`${item.chartCode}:${item.component.componentCode}`));

  const backToOverview = () => {
    const scopeQuery = searchParams.get('scope') === 'my' ? '?scope=my' : '';
    navigate(`/strategy/config${scopeQuery}`);
  };

  const persistDraft = (patch: Partial<Pick<StrategyConfigDraft, 'strategyId' | 'strategyName' | 'selectedChartIds' | 'savedAt' | 'publishedAt'>>) => {
    updateDraft(props.scope, draft.draftId, patch);
    setDraft(getDraft(props.scope, draft.draftId));
  };

  const saveDraft = () => {
    try {
      const now = new Date().toISOString();
      const nextName = strategyName.trim() || draft.strategyName;
      const nextCharts = selectedCharts.map(toStrategyChartSnapshot);
      if (draft.strategyId) {
        updateStrategy(draft.strategyId, {
          strategyName: nextName,
          charts: nextCharts
        }, props.scope);
      }
      persistDraft({
        strategyName: nextName,
        selectedChartIds: draft.selectedChartIds,
        savedAt: now
      });
      message.success(TEXT.draftSaved);
    } catch (saveError) {
      console.error(saveError);
      message.error(TEXT.saveFailed);
    }
  };

  const publishDraft = () => {
    if (draft.selectedChartIds.length === 0) {
      message.warning(TEXT.chartRequired);
      return;
    }
    try {
      const now = new Date().toISOString();
      const nextName = strategyName.trim() || draft.strategyName;
      const nextCharts = selectedCharts.map(toStrategyChartSnapshot);
      let strategyId = draft.strategyId;
      if (strategyId) {
        updateStrategy(strategyId, {
          strategyName: nextName,
          charts: nextCharts
        }, props.scope);
      } else {
        strategyId = createStrategy({
          scope: props.scope,
          strategyName: nextName,
          charts: nextCharts
        }).strategyId;
      }
      persistDraft({
        strategyId,
        strategyName: nextName,
        selectedChartIds: draft.selectedChartIds,
        savedAt: draft.savedAt ?? now,
        publishedAt: now
      });
      message.success(TEXT.created);
      backToOverview();
    } catch (publishError) {
      console.error(publishError);
      message.error(TEXT.publishFailed);
    }
  };

  const removeChart = (chartId: string) => {
    persistDraft({
      strategyName,
      selectedChartIds: draft.selectedChartIds.filter(item => item !== chartId)
    });
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
    persistDraft({
      strategyName,
      selectedChartIds: [...draft.selectedChartIds, ...addSelectedChartIds]
    });
    setAddChartOpen(false);
    setAddSelectedChartIds([]);
  };

  const finishChartDrag = () => {
    const sourceId = draggingChartIdRef.current;
    const targetId = dragOverChartIdRef.current;
    if (sourceId && targetId && sourceId !== targetId) {
      const fromIndex = draft.selectedChartIds.findIndex(item => item === sourceId);
      const toIndex = draft.selectedChartIds.findIndex(item => item === targetId);
      persistDraft({
        strategyName,
        selectedChartIds: reorderItemsPreview(draft.selectedChartIds, fromIndex, toIndex)
      });
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
      const targetId = resolveClosestSortIdFromPoint(moveEvent.clientX, moveEvent.clientY, 'data-selected-sort-id');
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

  useEffect(() => {
    if (!tocScrollRef.current || orderedSelectedCharts.length === 0) {
      return;
    }
    const firstId = `${orderedSelectedCharts[0].chartCode}:${orderedSelectedCharts[0].component.componentCode}`;
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${firstId}"]`);
  }, [orderedSelectedCharts]);

  return (
    <div>
      <div className="page-header">
        <div>
          <Space size={12}>
            <Button icon={<ArrowLeftOutlined />} onClick={backToOverview}>
              {TEXT.title}
            </Button>
            <h2 className="page-title" style={{ marginBottom: 0 }}>{strategyName || draft.strategyName}</h2>
          </Space>
          <div className="page-subtitle">
            {TEXT.detailFallback}
            {' | '}
            {TEXT.saveTime}：{formatDateTime(draft.savedAt)}
            {' | '}
            {TEXT.publishTime}：{draft.publishedAt ? formatDateTime(draft.publishedAt) : TEXT.unpublished}
          </div>
        </div>
        <Space wrap size={12} align="start">
          <div className="strategy-info-row" style={{ width: 240, gap: 6 }}>
            <span className="strategy-selection-title">{TEXT.strategyName}</span>
            <Input
              size="small"
              placeholder={TEXT.namePlaceholder}
              value={strategyName}
              onChange={event => setStrategyName(event.target.value)}
            />
          </div>
          <div className="strategy-selection-count" style={{ alignSelf: "end" }}>
            {draft.selectedChartIds.length} {TEXT.countSuffix}
          </div>
          <Button icon={<PlusOutlined />} onClick={() => setAddChartOpen(true)}>
            {TEXT.addChart}
          </Button>
          <Button onClick={saveDraft}>{TEXT.save}</Button>
          <Button type="primary" onClick={publishDraft}>{TEXT.publish}</Button>
        </Space>
      </div>

      <div className="page-shell runtime-library-shell">
        <div>
          {orderedSelectedCharts.length > 0 ? (
            <div className="favorites-board-grid public-chart-grid drag-sort-grid">
              {orderedSelectedCharts.map(item => {
                const chartId = `${item.chartCode}:${item.component.componentCode}`;
                return (
                  <article
                    key={chartId}
                    id={`strategy-config-selected-${chartId}`}
                    data-selected-sort-id={chartId}
                    className={`panel-card favorites-board-card public-board-card strategy-sort-card${draggingChartId === chartId ? ' strategy-sort-card-dragging' : ''}${dragOverChartId === chartId && draggingChartId !== chartId ? ' strategy-sort-card-drop-target' : ''}`}
                  >
                    <div className="favorites-board-card-head">
                      <div>
                        <h3 className="favorites-board-title">
                          {normalizeDisplayText(item.component.dslConfig.visualDsl.title || item.component.title, item.component.componentCode)}
                        </h3>
                      </div>
                      <div className="favorites-card-actions public-chart-card-actions">
                        <Button icon={<ExpandOutlined />} onClick={() => setExpandedChart(item)}>
                          放大
                        </Button>
                        <Button
                          className="thumbnail-drag-button"
                          icon={<HolderOutlined />}
                          title="拖拽排序"
                          aria-label="拖拽排序"
                          onMouseDown={event => startChartDrag(event, chartId)}
                        >
                          拖拽
                        </Button>
                        <Button danger onClick={() => removeChart(chartId)}>
                          {TEXT.removeFromStrategy}
                        </Button>
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
              <Empty description={TEXT.noSelectedChart} />
            </div>
          )}
        </div>

        <aside className="panel-card runtime-toc-card">
          <div className="runtime-toc-title">{TEXT.selectedCharts}</div>
          <div className="runtime-toc-scroll" ref={tocScrollRef}>
            <div className="runtime-toc-items">
              {selectedCharts.map(item => {
                const chartId = `${item.chartCode}:${item.component.componentCode}`;
                return (
                  <button
                    key={chartId}
                    type="button"
                    data-chart-code={chartId}
                    className="runtime-toc-item active"
                    onClick={() => document.getElementById(`strategy-config-selected-${chartId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  >
                    {normalizeDisplayText(item.component.dslConfig.visualDsl.title || item.component.title, item.component.componentCode)}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

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

      <Modal
        title={expandedChart ? normalizeDisplayText(expandedChart.component.dslConfig.visualDsl.title || expandedChart.component.title, expandedChart.component.componentCode) : TEXT.chartDetail}
        open={Boolean(expandedChart)}
        footer={null}
        destroyOnHidden
        onCancel={() => setExpandedChart(undefined)}
        width="90vw"
        styles={{ body: { height: '72vh', padding: 16 } }}
      >
        {expandedChart ? (
          <ChartRendererCore
            key={expandedChart.component.componentCode}
            component={expandedChart.component}
            preview={expandedChart.preview}
            templateCode={expandedChart.component.templateCode}
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
    </div>
  );
}

export default function StrategyConfig() {
  const [searchParams] = useSearchParams();
  const scope = searchParams.get('scope') === 'my' ? 'personal' : 'public';
  const backPath = scope === 'personal' ? '/my-strategy' : '/strategy-center';
  const draftId = searchParams.get('draft') ?? undefined;
  const [catalogCharts, setCatalogCharts] = useState<ChartCatalogItem[]>([]);
  const [availableCharts, setAvailableCharts] = useState<ChartRuntimeCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.listCharts()
      .then(setCatalogCharts)
      .catch(loadError => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : TEXT.loadFailed);
      });
  }, []);

  useEffect(() => {
    const publishedCharts = catalogCharts.filter(item => item.status === 'PUBLISHED');
    if (publishedCharts.length === 0) {
      setAvailableCharts([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all(publishedCharts.map(item => buildChartRuntimeCards(item.chartCode)))
      .then(entries => {
        if (!cancelled) {
          setAvailableCharts(entries.flat());
        }
      })
      .catch(loadError => {
        console.error(loadError);
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : TEXT.loadFailed);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalogCharts]);

  if (error) {
    return <Alert type="error" showIcon message={TEXT.loadFailed} description={error} />;
  }

  if (loading && availableCharts.length === 0) {
    return (
      <div className="panel-card canvas-card canvas-empty">
        <Empty description={TEXT.loadingCharts} />
      </div>
    );
  }

  return draftId
    ? <StrategyConfigEditor scope={scope} draftId={draftId} availableCharts={availableCharts} />
    : <StrategyConfigOverview scope={scope} backPath={backPath} availableCharts={availableCharts} />;
}
