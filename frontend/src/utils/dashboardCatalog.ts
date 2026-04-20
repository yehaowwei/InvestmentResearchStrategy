import type { DashboardCategoryKey, DashboardMeta, DashboardSummary } from '../types/dashboard';

const STORAGE_KEY = 'bi-dashboard-category-meta';

export const DASHBOARD_CATEGORIES: Array<{ key: DashboardCategoryKey; label: string }> = [
  { key: 'valuation', label: '估值指标' },
  { key: 'liquidity', label: '流动性指标' },
  { key: 'sentiment', label: '情绪指标' },
  { key: 'cycle', label: '周期定位指标' }
];

function defaultMeta(dashboardCode: string): DashboardMeta {
  return {
    dashboardCode,
    category: 'valuation',
    order: 0
  };
}

function readMetaMap() {
  if (typeof window === 'undefined') {
    return new Map<string, DashboardMeta>();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...metaMap.values()]));
}

export function normalizeCategoryKey(value?: string): DashboardCategoryKey {
  return DASHBOARD_CATEGORIES.some(item => item.key === value) ? (value as DashboardCategoryKey) : 'valuation';
}

export function getCategoryLabel(category: DashboardCategoryKey) {
  return DASHBOARD_CATEGORIES.find(item => item.key === category)?.label ?? '估值指标';
}

export function getDashboardMeta(dashboardCode: string): DashboardMeta {
  return readMetaMap().get(dashboardCode) ?? defaultMeta(dashboardCode);
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
