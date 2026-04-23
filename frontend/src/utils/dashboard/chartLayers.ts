import type { ChartLayerDsl } from '../../types/dashboard';
import { normalizeDisplayText } from '../dashboardText';

export function createChartLayer(index = 0): ChartLayerDsl {
  return {
    id: `chart-layer-${Date.now()}-${index}`,
    layerName: `图层 ${index + 1}`,
    enabled: true
  };
}

export function normalizeChartLayers(chartLayers: ChartLayerDsl[] | undefined) {
  if (chartLayers?.length) {
    return chartLayers.map((layer, index) => ({
      id: layer.id || `chart-layer-${index}`,
      layerName: normalizeDisplayText(layer.layerName, `图层 ${index + 1}`),
      enabled: layer.enabled ?? true
    }));
  }
  return [createChartLayer(0)];
}
