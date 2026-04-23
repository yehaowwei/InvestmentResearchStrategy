import type { ChartDefinition } from '../types/dashboard';
import { normalizeDashboard } from './dashboard';

export function normalizeChartDefinition(chart: ChartDefinition, options?: { primaryOnly?: boolean }) {
  const normalized = normalizeDashboard({
    dashboardCode: chart.chartCode,
    name: chart.chartName,
    status: chart.status,
    publishedVersion: chart.publishedVersion,
    components: chart.components
  });
  const primaryComponent = normalized.components[0];

  return {
    chartCode: normalized.dashboardCode,
    chartName: normalized.name,
    status: normalized.status,
    publishedVersion: normalized.publishedVersion,
    createdAt: chart.createdAt,
    updatedAt: chart.updatedAt,
    components: options?.primaryOnly === false
      ? normalized.components
      : (primaryComponent ? [primaryComponent] : [])
  } satisfies ChartDefinition;
}
