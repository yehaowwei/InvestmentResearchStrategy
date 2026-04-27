import type { ChartCatalogItem, DashboardCategoryKey, DashboardMeta, DashboardSummary } from '../types/dashboard';

const STORAGE_KEY = 'bi-dashboard-category-meta';

const BUILTIN_META: Record<string, DashboardMeta> = {
  margin_financing_dashboard: {
    dashboardCode: 'margin_financing_dashboard',
    category: 'liquidity',
    order: 1
  }
};

const CATEGORY_LABELS: Record<DashboardCategoryKey, string> = {
  valuation: '\u4f30\u503c\u6307\u6807',
  liquidity: '\u6d41\u52a8\u6027\u6307\u6807',
  sentiment: '\u60c5\u7eea\u6307\u6807',
  cycle: '\u5468\u671f\u5b9a\u4f4d\u6307\u6807',
  fixed_income: '\u56fa\u6536\u6307\u6807'
};

export const DASHBOARD_CATEGORIES: Array<{ key: DashboardCategoryKey; label: string }> = [
  { key: 'valuation', label: CATEGORY_LABELS.valuation },
  { key: 'liquidity', label: CATEGORY_LABELS.liquidity },
  { key: 'sentiment', label: CATEGORY_LABELS.sentiment },
  { key: 'cycle', label: CATEGORY_LABELS.cycle },
  { key: 'fixed_income', label: CATEGORY_LABELS.fixed_income }
];

function defaultMeta(dashboardCode: string): DashboardMeta {
  return BUILTIN_META[dashboardCode] ?? {
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
  return CATEGORY_LABELS[category] ?? CATEGORY_LABELS.valuation;
}

export function getDashboardMeta(dashboardCode: string) {
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
