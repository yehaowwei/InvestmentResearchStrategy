import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type {
  ChartCatalogItem,
  DashboardCategoryDefinition,
  DashboardCategoryKey,
  DashboardMeta,
  DashboardSummary
} from '../types/dashboard';

const META_STORAGE_KEY = 'strategy-dashboard-category-meta';
const CATEGORY_STORAGE_KEY = 'strategy-dashboard-category-definitions';
const META_CHANGE_EVENT = 'strategy-dashboard-category-meta-changed';
const CATEGORY_CHANGE_EVENT = 'strategy-dashboard-category-definitions-changed';

const BUILTIN_CATEGORIES: DashboardCategoryDefinition[] = [
  { key: 'valuation', label: '估值指标', order: 1 },
  { key: 'liquidity', label: '流动性指标', order: 2 },
  { key: 'sentiment', label: '情绪指标', order: 3 },
  { key: 'cycle', label: '周期定位指标', order: 4 },
];

const BUILTIN_META: Record<string, DashboardMeta> = {
  chart_6: {
    dashboardCode: 'chart_6',
    category: 'valuation',
    order: 1
  },
  chart_8: {
    dashboardCode: 'chart_8',
    category: 'valuation',
    order: 2
  },
  chart_10: {
    dashboardCode: 'chart_10',
    category: 'liquidity',
    order: 1
  },
  chart_11: {
    dashboardCode: 'chart_11',
    category: 'liquidity',
    order: 2
  },
  chart_171: {
    dashboardCode: 'chart_171',
    category: 'cycle',
    order: 2
  },
  chart_91: {
    dashboardCode: 'chart_91',
    category: 'cycle',
    order: 1
  },
  margin_financing_dashboard: {
    dashboardCode: 'margin_financing_dashboard',
    category: 'liquidity',
    order: 1
  }
};

function normalizeCategoryLabel(value?: string) {
  return (value || '').trim();
}

function toCategoryKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'category';
}

function normalizeCategories(input?: DashboardCategoryDefinition[]) {
  const source = Array.isArray(input) ? input : BUILTIN_CATEGORIES;
  const merged = new Map<string, DashboardCategoryDefinition>();

  BUILTIN_CATEGORIES.forEach(item => {
    merged.set(item.key, item);
  });

  source.forEach((item, index) => {
    const key = typeof item?.key === 'string' ? item.key.trim() : '';
    const label = normalizeCategoryLabel(item?.label);
    if (!key || !label) {
      return;
    }
    merged.set(key, {
      key,
      label,
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1
    });
  });

  return [...merged.values()].sort((a, b) => (a.order - b.order) || a.key.localeCompare(b.key));
}

function readCategories() {
  if (typeof window === 'undefined') {
    return normalizeCategories(BUILTIN_CATEGORIES);
  }
  try {
    const raw = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!raw) {
      return normalizeCategories(BUILTIN_CATEGORIES);
    }
    return normalizeCategories(JSON.parse(raw) as DashboardCategoryDefinition[]);
  } catch {
    return normalizeCategories(BUILTIN_CATEGORIES);
  }
}

function writeCategories(categories: DashboardCategoryDefinition[]) {
  if (typeof window === 'undefined') {
    return;
  }
  const normalized = normalizeCategories(categories);
  window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(CATEGORY_CHANGE_EVENT));
  void api.saveSharedState(CATEGORY_STORAGE_KEY, normalized).catch(() => undefined);
}

function defaultCategoryKey() {
  return readCategories()[0]?.key ?? BUILTIN_CATEGORIES[0].key;
}

function defaultMeta(dashboardCode: string): DashboardMeta {
  return BUILTIN_META[dashboardCode] ?? {
    dashboardCode,
    category: defaultCategoryKey(),
    order: 0
  };
}

function readMetaMap() {
  if (typeof window === 'undefined') {
    return new Map<string, DashboardMeta>();
  }
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY);
    if (!raw) {
      return new Map<string, DashboardMeta>();
    }
    const parsed = JSON.parse(raw) as DashboardMeta[];
    return new Map(
      (Array.isArray(parsed) ? parsed : [])
        .filter(item => item?.dashboardCode)
        .map(item => [item.dashboardCode, {
          dashboardCode: item.dashboardCode,
          category: normalizeCategoryKey(item.category),
          order: Number(item.order ?? 0)
        }])
    );
  } catch {
    return new Map<string, DashboardMeta>();
  }
}

function writeMetaMap(metaMap: Map<string, DashboardMeta>) {
  if (typeof window === 'undefined') {
    return;
  }
  const serialized = JSON.stringify([...metaMap.values()]);
  window.localStorage.setItem(META_STORAGE_KEY, serialized);
  window.dispatchEvent(new CustomEvent(META_CHANGE_EVENT));
  void api.saveSharedState(META_STORAGE_KEY, [...metaMap.values()]).catch(() => undefined);
}

export function listDashboardCategories() {
  return readCategories();
}

export const DASHBOARD_CATEGORIES = BUILTIN_CATEGORIES;

export function useDashboardCategories() {
  const [categories, setCategories] = useState<DashboardCategoryDefinition[]>(() => listDashboardCategories());

  useEffect(() => {
    const sync = () => setCategories(listDashboardCategories());
    window.addEventListener('storage', sync);
    window.addEventListener(CATEGORY_CHANGE_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(CATEGORY_CHANGE_EVENT, sync as EventListener);
    };
  }, []);

  return categories;
}

export function normalizeCategoryKey(value?: string): DashboardCategoryKey {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) {
    return defaultCategoryKey();
  }
  return listDashboardCategories().some(item => item.key === normalized) ? normalized : defaultCategoryKey();
}

export function getCategoryLabel(category: DashboardCategoryKey) {
  return listDashboardCategories().find(item => item.key === category)?.label ?? category;
}

export function ensureDashboardMeta(dashboardCode: string, patch?: Partial<DashboardMeta>) {
  const metaMap = readMetaMap();
  const next = {
    ...defaultMeta(dashboardCode),
    ...metaMap.get(dashboardCode),
    ...patch,
    dashboardCode,
    category: normalizeCategoryKey(patch?.category ?? metaMap.get(dashboardCode)?.category)
  };
  metaMap.set(dashboardCode, next);
  writeMetaMap(metaMap);
  return next;
}

export function removeDashboardMeta(dashboardCode: string) {
  const metaMap = readMetaMap();
  metaMap.delete(dashboardCode);
  writeMetaMap(metaMap);
}

export function dashboardMetaChangeEventName() {
  return META_CHANGE_EVENT;
}

export function dashboardCategoryChangeEventName() {
  return CATEGORY_CHANGE_EVENT;
}

export function createDashboardCategory(input: { label: string; key?: string }) {
  const label = normalizeCategoryLabel(input.label);
  if (!label) {
    throw new Error('请输入分类名称');
  }
  const categories = listDashboardCategories();
  const resolvedKey = (input.key?.trim() || toCategoryKey(label));
  if (categories.some(item => item.key === resolvedKey)) {
    throw new Error('分类编码已存在，请调整分类名称');
  }
  const nextCategory = {
    key: resolvedKey,
    label,
    order: categories.length + 1
  } satisfies DashboardCategoryDefinition;
  writeCategories([...categories, nextCategory]);
  return nextCategory;
}

export async function syncDashboardCategoriesFromServer() {
  const localValues = listDashboardCategories();
  try {
    const remote = await api.getSharedState(CATEGORY_STORAGE_KEY);
    if (Array.isArray(remote)) {
      const remoteValues = normalizeCategories(
        remote.filter((item): item is DashboardCategoryDefinition => Boolean(item && typeof item === 'object' && 'key' in item))
      );
      if (typeof window !== 'undefined' && JSON.stringify(remoteValues) !== JSON.stringify(localValues)) {
        window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(remoteValues));
        window.dispatchEvent(new CustomEvent(CATEGORY_CHANGE_EVENT));
      }
      return remoteValues;
    }

    if (localValues.length > 0) {
      await api.saveSharedState(CATEGORY_STORAGE_KEY, localValues);
    }
  } catch {
    return localValues;
  }

  return localValues;
}

export async function syncDashboardMetaFromServer() {
  if (typeof window === 'undefined') {
    return [...readMetaMap().values()];
  }

  const localValues = [...readMetaMap().values()];
  try {
    const remote = await api.getSharedState(META_STORAGE_KEY);
    if (Array.isArray(remote)) {
      const nextMap = new Map(
        remote
          .filter((item): item is DashboardMeta => Boolean(item && typeof item === 'object' && 'dashboardCode' in item))
          .map(item => [item.dashboardCode, {
            dashboardCode: item.dashboardCode,
            category: normalizeCategoryKey(item.category),
            order: Number(item.order ?? 0)
          }])
      );
      const remoteValues = [...nextMap.values()];
      if (JSON.stringify(remoteValues) !== JSON.stringify(localValues)) {
        window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(remoteValues));
        window.dispatchEvent(new CustomEvent(META_CHANGE_EVENT));
      }
      return remoteValues;
    }

    if (localValues.length > 0) {
      await api.saveSharedState(META_STORAGE_KEY, localValues);
    }
  } catch {
    return localValues;
  }

  return localValues;
}

export function filterDashboardsByCategory(dashboards: DashboardSummary[], category: DashboardCategoryKey, publishedOnly = false) {
  return dashboards
    .filter(item => !publishedOnly || item.status === 'PUBLISHED')
    .filter(item => getDashboardMeta(item.dashboardCode).category === category)
    .sort((a, b) => {
      const metaA = getDashboardMeta(a.dashboardCode);
      const metaB = getDashboardMeta(b.dashboardCode);
      if (metaA.order !== metaB.order) {
        return metaA.order - metaB.order;
      }
      return a.dashboardCode.localeCompare(b.dashboardCode);
    });
}

export function filterChartsByCategory(charts: ChartCatalogItem[], category: DashboardCategoryKey, publishedOnly = false) {
  return charts
    .filter(item => !publishedOnly || item.status === 'PUBLISHED')
    .filter(item => getDashboardMeta(item.chartCode).category === category)
    .sort((a, b) => {
      const metaA = getDashboardMeta(a.chartCode);
      const metaB = getDashboardMeta(b.chartCode);
      if (metaA.order !== metaB.order) {
        return metaA.order - metaB.order;
      }
      return a.chartCode.localeCompare(b.chartCode);
    });
}

export function getDashboardMeta(dashboardCode: string) {
  return readMetaMap().get(dashboardCode) ?? defaultMeta(dashboardCode);
}
