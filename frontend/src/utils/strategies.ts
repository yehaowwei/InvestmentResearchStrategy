import { api } from '../api/client';
import type { ComponentDslConfig } from '../types/dashboard';
import type { ChartRuntimeCard } from './chartLibrary';
import { repairCycleStrategyDsl } from './cycleStrategy';
import { deepClone, normalizeDisplayText, normalizeDslConfig } from './dashboard';

const STORAGE_KEYS = {
  public: 'strategy-dashboard-strategies',
  personal: 'strategy-dashboard-my-strategies'
} as const;

const CHANGE_EVENTS = {
  public: 'strategy-dashboard-strategies-changed',
  personal: 'strategy-dashboard-my-strategies-changed'
} as const;

export type StrategyScope = 'public' | 'personal';

export interface StrategyChartSnapshot {
  chartId: string;
  chartCode: string;
  chartName: string;
  componentCode: string;
  componentTitle: string;
  templateCode: string;
  modelCode: string;
  dslConfig: ComponentDslConfig;
  addedAt: string;
}

export interface StrategyRecord {
  strategyId: string;
  strategyName: string;
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  charts: StrategyChartSnapshot[];
  sourceStrategyId?: string;
}

function normalizeChartSnapshot(chart: StrategyChartSnapshot): StrategyChartSnapshot {
  const normalizedDsl = normalizeDslConfig(deepClone(chart.dslConfig));
  return {
    ...chart,
    chartId: normalizeDisplayText(chart.chartId, `${chart.chartCode}:${chart.componentCode}`),
    chartName: normalizeDisplayText(chart.chartName, chart.chartCode),
    componentTitle: normalizeDisplayText(chart.componentTitle, chart.componentCode),
    dslConfig: repairCycleStrategyDsl(normalizedDsl)
  };
}

function normalizeStrategy(strategy: StrategyRecord, fallbackOrder = 0): StrategyRecord {
  return {
    ...strategy,
    strategyName: normalizeDisplayText(strategy.strategyName, strategy.strategyId),
    description: strategy.description || '',
    order: Number.isFinite(strategy.order) ? strategy.order : fallbackOrder,
    charts: Array.isArray(strategy.charts) ? strategy.charts.map(normalizeChartSnapshot) : []
  };
}

function readStrategies(scope: StrategyScope) {
  if (typeof window === 'undefined') {
    return [] as StrategyRecord[];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS[scope]);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StrategyRecord[];
    const strategies = Array.isArray(parsed) ? parsed.map((item, index) => normalizeStrategy(item, index + 1)) : [];
    return strategies;
  } catch {
    return [];
  }
}

function sortStrategies(strategies: StrategyRecord[]) {
  return [...strategies].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function writeStrategies(scope: StrategyScope, strategies: StrategyRecord[], syncRemote = true) {
  if (typeof window === 'undefined') {
    return;
  }
  const nextStrategies = sortStrategies(strategies);
  window.localStorage.setItem(STORAGE_KEYS[scope], JSON.stringify(nextStrategies));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENTS[scope]));
  if (syncRemote) {
    void api.saveSharedState(STORAGE_KEYS[scope], nextStrategies).catch(() => undefined);
  }
}

function updateStrategies(scope: StrategyScope, updater: (strategies: StrategyRecord[]) => StrategyRecord[]) {
  writeStrategies(scope, updater(readStrategies(scope)));
}

export function strategyChangeEventName(scope: StrategyScope = 'public') {
  return CHANGE_EVENTS[scope];
}

export function listStrategies(scope: StrategyScope = 'public') {
  return sortStrategies(readStrategies(scope));
}

export function listMyStrategies() {
  return listStrategies('personal');
}

export function getStrategy(strategyId?: string, scope: StrategyScope = 'public') {
  if (!strategyId) {
    return undefined;
  }
  return listStrategies(scope).find(item => item.strategyId === strategyId);
}

export function getMyStrategy(strategyId?: string) {
  return getStrategy(strategyId, 'personal');
}

export function deleteStrategy(strategyId: string, scope: StrategyScope = 'public') {
  updateStrategies(scope, strategies => strategies.filter(item => item.strategyId !== strategyId));
}

export function updateStrategy(
  strategyId: string,
  patch: Partial<Pick<StrategyRecord, 'strategyName' | 'description' | 'charts'>>,
  scope: StrategyScope = 'public'
) {
  updateStrategies(scope, strategies => strategies.map(strategy => {
    if (strategy.strategyId !== strategyId) {
      return strategy;
    }
    return {
      ...strategy,
      strategyName: patch.strategyName != null
        ? normalizeDisplayText(patch.strategyName, strategy.strategyId)
        : strategy.strategyName,
      description: patch.description != null ? patch.description.trim() : strategy.description,
      charts: patch.charts ? patch.charts.map(normalizeChartSnapshot) : strategy.charts,
      updatedAt: new Date().toISOString()
    };
  }));
}

export function reorderStrategies(strategyIds: string[], scope: StrategyScope = 'public') {
  const orderMap = new Map(strategyIds.map((strategyId, index) => [strategyId, index + 1] as const));
  updateStrategies(scope, strategies => strategies.map((strategy, index) => ({
    ...strategy,
    order: orderMap.get(strategy.strategyId) ?? (strategyIds.length + index + 1),
    updatedAt: orderMap.has(strategy.strategyId) ? new Date().toISOString() : strategy.updatedAt
  })));
}

export function toStrategyChartSnapshot(card: ChartRuntimeCard): StrategyChartSnapshot {
  return {
    chartId: `${card.chartCode}:${card.component.componentCode}`,
    chartCode: card.chartCode,
    chartName: normalizeDisplayText(card.chartName, card.chartCode),
    componentCode: card.component.componentCode,
    componentTitle: normalizeDisplayText(
      card.component.dslConfig.visualDsl.title || card.component.title,
      card.component.componentCode
    ),
    templateCode: card.component.templateCode,
    modelCode: card.component.modelCode,
    dslConfig: normalizeDslConfig(deepClone(card.component.dslConfig)),
    addedAt: new Date().toISOString()
  };
}

export function createStrategy(input: {
  strategyName: string;
  description?: string;
  charts: StrategyChartSnapshot[];
  scope?: StrategyScope;
  sourceStrategyId?: string;
}) {
  const scope = input.scope ?? 'public';
  const strategies = readStrategies(scope);
  const timestamp = Date.now();
  const now = new Date().toISOString();
  const nextStrategy: StrategyRecord = {
    strategyId: `${scope === 'public' ? 'strategy' : 'my-strategy'}-${timestamp}`,
    strategyName: normalizeDisplayText(input.strategyName, `${scope}-strategy-${timestamp}`),
    description: input.description?.trim() || '',
    order: strategies.length + 1,
    createdAt: now,
    updatedAt: now,
    charts: input.charts.map(normalizeChartSnapshot),
    sourceStrategyId: input.sourceStrategyId
  };
  strategies.push(nextStrategy);
  writeStrategies(scope, strategies);
  return nextStrategy;
}

export function isStrategyFavorited(sourceStrategyId: string) {
  return listStrategies('personal').some(item => item.sourceStrategyId === sourceStrategyId);
}

export function favoriteStrategy(strategyId: string) {
  const strategy = getStrategy(strategyId, 'public');
  if (!strategy) {
    return undefined;
  }
  const existing = listStrategies('personal').find(item => item.sourceStrategyId === strategy.strategyId);
  if (existing) {
    return existing;
  }
  return createStrategy({
    scope: 'personal',
    strategyName: strategy.strategyName,
    description: strategy.description,
    charts: strategy.charts.map(normalizeChartSnapshot),
    sourceStrategyId: strategy.strategyId
  });
}

export async function syncStrategiesFromServer(scope: StrategyScope) {
  if (typeof window === 'undefined') {
    return [] as StrategyRecord[];
  }

  const localStrategies = sortStrategies(readStrategies(scope));
  try {
    const remote = await api.getSharedState(STORAGE_KEYS[scope]);
    if (Array.isArray(remote)) {
      const remoteStrategies = sortStrategies(remote.map((item, index) => normalizeStrategy(item as StrategyRecord, index + 1)));
      if (JSON.stringify(remoteStrategies) !== JSON.stringify(localStrategies)) {
        writeStrategies(scope, remoteStrategies, false);
      }
      return remoteStrategies;
    }

    if (localStrategies.length > 0) {
      await api.saveSharedState(STORAGE_KEYS[scope], localStrategies);
    }
  } catch {
    return localStrategies;
  }

  return localStrategies;
}
