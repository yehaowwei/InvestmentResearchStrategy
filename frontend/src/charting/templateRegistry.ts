import { buildCartesianComboOption } from './builders/cartesianComboBuilder';
import type { ChartTemplateDefinition } from './types';

const templates: Record<string, ChartTemplateDefinition> = {
  line: {
    code: 'line',
    renderer: 'cartesian_combo',
    buildOption: buildCartesianComboOption
  },
  mixed: {
    code: 'mixed',
    renderer: 'cartesian_combo',
    buildOption: buildCartesianComboOption
  },
  bar: {
    code: 'bar',
    renderer: 'cartesian_combo',
    buildOption: buildCartesianComboOption
  },
  cartesian_combo: {
    code: 'cartesian_combo',
    renderer: 'cartesian_combo',
    buildOption: buildCartesianComboOption
  },
  scatter: {
    code: 'scatter',
    renderer: 'scatter_quadrant'
  },
  table: {
    code: 'table',
    renderer: 'table'
  }
};

export function getChartTemplate(code?: string) {
  return templates[code ?? 'line'] ?? templates.line;
}
