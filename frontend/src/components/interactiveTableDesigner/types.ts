import type { TableMergeDsl } from '../../types/dashboard';

export type TableRegion = 'body';

export interface SelectionRange {
  region: TableRegion;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface GridCell {
  key: string;
  region: TableRegion;
  rowIndex: number;
  colIndex: number;
  text: string;
  sourceText?: string;
  value?: unknown;
  fieldCode?: string;
}

export interface CellSpan {
  rowSpan: number;
  colSpan: number;
}

export type MergeMatcher = (merge: TableMergeDsl, cell: GridCell) => boolean;
