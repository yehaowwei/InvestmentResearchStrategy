import type { EChartsOption } from 'echarts';
import type { ChartLayerContext, ChartPreview } from '../types/dashboard';

export type ChartRenderContext = ChartLayerContext & {
  zoomRange?: {
    start: number;
    end: number;
  };
  compact?: boolean;
  dense?: boolean;
  thumbnail?: boolean;
};

export interface ChartTemplateDefinition {
  code: string;
  renderer: 'cartesian_combo' | 'scatter_quadrant' | 'pie' | 'table';
  buildOption?: (
    preview: ChartPreview,
    context?: ChartRenderContext
  ) => EChartsOption;
}
