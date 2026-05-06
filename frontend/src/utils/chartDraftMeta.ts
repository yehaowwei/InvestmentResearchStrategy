export interface ChartDraftMeta {
  chartCode: string;
  draftSavedAt?: string;
  publishedAt?: string;
}

const STORAGE_KEY = 'strategy-dashboard-chart-draft-meta';

function readMap() {
  if (typeof window === 'undefined') {
    return new Map<string, ChartDraftMeta>();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Map<string, ChartDraftMeta>();
    }
    const parsed = JSON.parse(raw) as ChartDraftMeta[];
    const metaMap = new Map(
      (Array.isArray(parsed) ? parsed : [])
        .filter(item => item?.chartCode)
        .map(item => [item.chartCode, { ...item, chartCode: item.chartCode }])
    );
    return metaMap;
  } catch {
    return new Map<string, ChartDraftMeta>();
  }
}

function writeMap(metaMap: Map<string, ChartDraftMeta>) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...metaMap.values()]));
}

export function getChartDraftMeta(chartCode: string) {
  return readMap().get(chartCode) ?? { chartCode };
}

export function updateChartDraftMeta(chartCode: string, patch: Partial<ChartDraftMeta>) {
  const metaMap = readMap();
  metaMap.set(chartCode, {
    ...getChartDraftMeta(chartCode),
    ...patch,
    chartCode
  });
  writeMap(metaMap);
  return metaMap.get(chartCode)!;
}

export function removeChartDraftMeta(chartCode: string) {
  const metaMap = readMap();
  metaMap.delete(chartCode);
  writeMap(metaMap);
}
