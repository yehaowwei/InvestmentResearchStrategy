import type { TableBodyCellDsl, TableMergeDsl, TableStyleRule } from '../../types/dashboard';
import type { CellSpan, GridCell, SelectionRange, TableRegion } from './types';

export function cellStyleKey(region: TableRegion, rowIndex: number, colIndex: number) {
  return `${region}:${rowIndex}:${colIndex}`;
}

export function normalizeSelection(selection: SelectionRange): SelectionRange {
  return {
    region: selection.region,
    startRow: Math.min(selection.startRow, selection.endRow),
    endRow: Math.max(selection.startRow, selection.endRow),
    startCol: Math.min(selection.startCol, selection.endCol),
    endCol: Math.max(selection.startCol, selection.endCol)
  };
}

export function isSelected(selection: SelectionRange | null, cell: GridCell) {
  if (!selection || selection.region !== cell.region) {
    return false;
  }
  return cell.rowIndex >= selection.startRow
    && cell.rowIndex <= selection.endRow
    && cell.colIndex >= selection.startCol
    && cell.colIndex <= selection.endCol;
}

export function matchesMerge(merge: TableMergeDsl, cell: GridCell) {
  return merge.region === cell.region
    && cell.rowIndex >= merge.rowIndex
    && cell.rowIndex < merge.rowIndex + merge.rowSpan
    && cell.colIndex >= merge.colIndex
    && cell.colIndex < merge.colIndex + merge.colSpan;
}

export function shouldHideCell(merges: TableMergeDsl[], cell: GridCell) {
  const merge = merges.find(item => matchesMerge(item, cell));
  return Boolean(merge && !(merge.rowIndex === cell.rowIndex && merge.colIndex === cell.colIndex));
}

export function getCellSpan(merges: TableMergeDsl[], cell: GridCell): CellSpan {
  const merge = merges.find(item => (
    item.region === cell.region
    && item.rowIndex === cell.rowIndex
    && item.colIndex === cell.colIndex
  ));
  return {
    rowSpan: merge?.rowSpan ?? 1,
    colSpan: merge?.colSpan ?? 1
  };
}

export function compareRule(operator: string, value: number, ruleValue: number) {
  switch (operator) {
    case 'gt': return value > ruleValue;
    case 'gte': return value >= ruleValue;
    case 'lt': return value < ruleValue;
    case 'lte': return value <= ruleValue;
    case 'eq': return value === ruleValue;
    default: return false;
  }
}

export function createBodyCell(rowIndex: number, colIndex: number, text = '', fieldCode = ''): TableBodyCellDsl {
  return {
    key: `body-${rowIndex}-${colIndex}-${Date.now()}`,
    rowIndex,
    colIndex,
    fieldCode,
    text,
    sourceText: text,
    textOverride: text,
    value: text
  };
}

export function shiftMerges(merges: TableMergeDsl[], axis: 'row' | 'col', target: number, delta: number) {
  return merges
    .filter(merge => {
      if (axis === 'row') {
        return !(delta < 0 && merge.rowIndex === target);
      }
      return !(delta < 0 && merge.colIndex === target);
    })
    .map(merge => {
      if (axis === 'row' && merge.rowIndex >= target) {
        return { ...merge, rowIndex: merge.rowIndex + delta };
      }
      if (axis === 'col' && merge.colIndex >= target) {
        return { ...merge, colIndex: merge.colIndex + delta };
      }
      return merge;
    });
}

export function resolveCellStyle(
  styleMap: Record<string, TableStyleRule>,
  conditionalFormats: Array<{
    target?: 'body' | 'header' | 'all';
    fieldCode?: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
    value: number;
    style: TableStyleRule;
  }>,
  cell: GridCell
) {
  const style = styleMap[cellStyleKey('body', cell.rowIndex, cell.colIndex)] ?? {};
  const matched = cell.rowIndex === 0 ? undefined : conditionalFormats.find(rule => {
    if (rule.target && rule.target !== 'body' && rule.target !== 'all') {
      return false;
    }
    if (rule.fieldCode && rule.fieldCode !== cell.fieldCode) {
      return false;
    }
    const numeric = Number(cell.value ?? cell.text);
    if (!Number.isFinite(numeric)) {
      return false;
    }
    return compareRule(rule.operator, numeric, rule.value);
  });
  return matched ? { ...style, ...matched.style } : style;
}
