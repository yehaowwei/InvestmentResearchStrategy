import {
  BorderOutlined,
  ColumnWidthOutlined,
  DeleteColumnOutlined,
  DeleteRowOutlined,
  InsertRowAboveOutlined,
  InsertRowBelowOutlined,
  UngroupOutlined
} from '@ant-design/icons';
import { Button, Empty, Input, Space } from 'antd';
import { useMemo, useState } from 'react';
import type {
  DashboardComponent,
  DataPool,
  TableBodyCellDsl,
  TableMergeDsl,
  TableStyleRule
} from '../types/dashboard';
import { resolveModel } from '../utils/dashboard';

type TableRegion = 'body';

interface SelectionRange {
  region: TableRegion;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

interface GridCell {
  key: string;
  region: TableRegion;
  rowIndex: number;
  colIndex: number;
  text: string;
  sourceText?: string;
  value?: unknown;
  fieldCode?: string;
}

function cellStyleKey(region: TableRegion, rowIndex: number, colIndex: number) {
  return `${region}:${rowIndex}:${colIndex}`;
}

function normalizeSelection(selection: SelectionRange): SelectionRange {
  return {
    region: selection.region,
    startRow: Math.min(selection.startRow, selection.endRow),
    endRow: Math.max(selection.startRow, selection.endRow),
    startCol: Math.min(selection.startCol, selection.endCol),
    endCol: Math.max(selection.startCol, selection.endCol)
  };
}

function isSelected(selection: SelectionRange | null, cell: GridCell) {
  if (!selection || selection.region !== cell.region) {
    return false;
  }
  return cell.rowIndex >= selection.startRow
    && cell.rowIndex <= selection.endRow
    && cell.colIndex >= selection.startCol
    && cell.colIndex <= selection.endCol;
}

function matchesMerge(merge: TableMergeDsl, cell: GridCell) {
  return merge.region === cell.region
    && cell.rowIndex >= merge.rowIndex
    && cell.rowIndex < merge.rowIndex + merge.rowSpan
    && cell.colIndex >= merge.colIndex
    && cell.colIndex < merge.colIndex + merge.colSpan;
}

function shouldHideCell(merges: TableMergeDsl[], cell: GridCell) {
  const merge = merges.find(item => matchesMerge(item, cell));
  return Boolean(merge && !(merge.rowIndex === cell.rowIndex && merge.colIndex === cell.colIndex));
}

function getCellSpan(merges: TableMergeDsl[], cell: GridCell) {
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

function compareRule(operator: string, value: number, ruleValue: number) {
  switch (operator) {
    case 'gt': return value > ruleValue;
    case 'gte': return value >= ruleValue;
    case 'lt': return value < ruleValue;
    case 'lte': return value <= ruleValue;
    case 'eq': return value === ruleValue;
    default: return false;
  }
}

function createBodyCell(rowIndex: number, colIndex: number, text = '', fieldCode = ''): TableBodyCellDsl {
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

function shiftMerges(merges: TableMergeDsl[], axis: 'row' | 'col', target: number, delta: number) {
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

export default function InteractiveTableDesigner(props: {
  component: DashboardComponent;
  previewRows: Record<string, unknown>[];
  dataPools: DataPool[];
  selected: boolean;
  onChange: (component: DashboardComponent) => void;
  onPreview: (component: DashboardComponent) => void;
}) {
  const model = resolveModel(props.dataPools, props.component.modelCode);
  const tableDsl = props.component.dslConfig.tableDsl;
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [dragging, setDragging] = useState(false);
  const [paintColor, setPaintColor] = useState('#fff7d6');
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const bodyCells = useMemo<GridCell[]>(() => (
    (tableDsl?.bodyCells ?? []).map(cell => ({
      key: cell.key,
      region: 'body',
      rowIndex: cell.rowIndex,
      colIndex: cell.colIndex,
      text: String(cell.textOverride ?? cell.text ?? cell.sourceText ?? cell.value ?? ''),
      sourceText: cell.sourceText,
      value: cell.value,
      fieldCode: cell.fieldCode
    }))
  ), [tableDsl?.bodyCells]);

  const rowCount = Math.max(1, ...bodyCells.map(cell => cell.rowIndex + 1), 1);
  const colCount = Math.max(1, ...bodyCells.map(cell => cell.colIndex + 1), 1);

  const applyComponent = (updater: (component: DashboardComponent) => DashboardComponent) => {
    props.onChange(updater(props.component));
  };

  const fillSelectedCells = () => {
    if (!selection) {
      return;
    }
    const normalized = normalizeSelection(selection);
    applyComponent(component => {
      const currentStyles = component.dslConfig.tableDsl?.styles ?? {};
      const nextStyles = { ...currentStyles };
      for (let rowIndex = normalized.startRow; rowIndex <= normalized.endRow; rowIndex += 1) {
        for (let colIndex = normalized.startCol; colIndex <= normalized.endCol; colIndex += 1) {
          const key = cellStyleKey('body', rowIndex, colIndex);
          nextStyles[key] = {
            ...(nextStyles[key] as TableStyleRule | undefined),
            backgroundColor: paintColor
          };
        }
      }
      return {
        ...component,
        dslConfig: {
          ...component.dslConfig,
          tableDsl: {
            ...component.dslConfig.tableDsl!,
            styles: nextStyles
          }
        }
      };
    });
  };

  const saveEditing = () => {
    if (!editingCell) {
      return;
    }
    applyComponent(component => ({
      ...component,
      dslConfig: {
        ...component.dslConfig,
        tableDsl: {
          ...component.dslConfig.tableDsl!,
          bodyCells: component.dslConfig.tableDsl!.bodyCells.map(cell => (
            cell.rowIndex === editingCell.rowIndex && cell.colIndex === editingCell.colIndex
              ? { ...cell, text: editingValue, textOverride: editingValue, value: editingValue }
              : cell
          ))
        }
      }
    }));
    setEditingCell(null);
  };

  const mergeSelection = () => {
    if (!selection) {
      return;
    }
    const normalized = normalizeSelection(selection);
    if (normalized.startRow === normalized.endRow && normalized.startCol === normalized.endCol) {
      return;
    }
    applyComponent(component => ({
      ...component,
      dslConfig: {
        ...component.dslConfig,
        tableDsl: {
          ...component.dslConfig.tableDsl!,
          merges: [
            ...component.dslConfig.tableDsl!.merges.filter(merge => !(
              merge.region === 'body'
              && merge.rowIndex <= normalized.endRow
              && merge.rowIndex + merge.rowSpan - 1 >= normalized.startRow
              && merge.colIndex <= normalized.endCol
              && merge.colIndex + merge.colSpan - 1 >= normalized.startCol
            )),
            {
              key: `merge-body-${normalized.startRow}-${normalized.startCol}-${Date.now()}`,
              region: 'body',
              rowIndex: normalized.startRow,
              colIndex: normalized.startCol,
              rowSpan: normalized.endRow - normalized.startRow + 1,
              colSpan: normalized.endCol - normalized.startCol + 1
            }
          ]
        }
      }
    }));
  };

  const splitSelection = () => {
    if (!selection) {
      return;
    }
    const normalized = normalizeSelection(selection);
    applyComponent(component => ({
      ...component,
      dslConfig: {
        ...component.dslConfig,
        tableDsl: {
          ...component.dslConfig.tableDsl!,
          merges: component.dslConfig.tableDsl!.merges.filter(merge => !(
            merge.region === 'body'
            && merge.rowIndex <= normalized.endRow
            && merge.rowIndex + merge.rowSpan - 1 >= normalized.startRow
            && merge.colIndex <= normalized.endCol
            && merge.colIndex + merge.colSpan - 1 >= normalized.startCol
          ))
        }
      }
    }));
  };

  const insertRow = (direction: 'above' | 'below') => {
    const normalized = selection ? normalizeSelection(selection) : null;
    const anchor = normalized ? normalized.startRow : rowCount - 1;
    const targetRow = direction === 'above' ? anchor : anchor + 1;
    applyComponent(component => {
      const nextBodyCells = component.dslConfig.tableDsl!.bodyCells.map(cell => (
        cell.rowIndex >= targetRow ? { ...cell, rowIndex: cell.rowIndex + 1 } : cell
      ));
      for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
        nextBodyCells.push(createBodyCell(targetRow, colIndex));
      }
      return {
        ...component,
        dslConfig: {
          ...component.dslConfig,
          tableDsl: {
            ...component.dslConfig.tableDsl!,
            bodyCells: nextBodyCells,
            merges: shiftMerges(component.dslConfig.tableDsl!.merges, 'row', targetRow, 1)
          }
        }
      };
    });
  };

  const deleteRow = () => {
    const normalized = selection ? normalizeSelection(selection) : null;
    const targetRow = normalized?.startRow;
    if (targetRow == null) {
      return;
    }
    applyComponent(component => ({
      ...component,
      dslConfig: {
        ...component.dslConfig,
        tableDsl: {
          ...component.dslConfig.tableDsl!,
          bodyCells: component.dslConfig.tableDsl!.bodyCells
            .filter(cell => cell.rowIndex !== targetRow)
            .map(cell => (cell.rowIndex > targetRow ? { ...cell, rowIndex: cell.rowIndex - 1 } : cell)),
          merges: shiftMerges(component.dslConfig.tableDsl!.merges, 'row', targetRow, -1)
        }
      }
    }));
    setSelection(null);
  };

  const insertColumn = (direction: 'left' | 'right') => {
    const normalized = selection ? normalizeSelection(selection) : null;
    const anchor = normalized ? normalized.startCol : colCount - 1;
    const targetCol = direction === 'left' ? anchor : anchor + 1;
    applyComponent(component => {
      const nextBodyCells = component.dslConfig.tableDsl!.bodyCells.map(cell => (
        cell.colIndex >= targetCol ? { ...cell, colIndex: cell.colIndex + 1 } : cell
      ));
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        nextBodyCells.push(createBodyCell(rowIndex, targetCol, rowIndex === 0 ? `新列${targetCol + 1}` : ''));
      }
      const nextColumns = [...component.dslConfig.tableDsl!.columns];
      nextColumns.splice(targetCol, 0, {
        id: `manual-col-${Date.now()}-${targetCol}`,
        fieldCode: '',
        title: `新列${targetCol + 1}`,
        role: 'dimension',
        width: 140,
        align: 'left',
        formatter: 'text',
        visible: true,
        groupTitle: ''
      });
      return {
        ...component,
        dslConfig: {
          ...component.dslConfig,
          tableDsl: {
            ...component.dslConfig.tableDsl!,
            columns: nextColumns,
            bodyCells: nextBodyCells,
            merges: shiftMerges(component.dslConfig.tableDsl!.merges, 'col', targetCol, 1)
          }
        }
      };
    });
  };

  const deleteColumn = () => {
    const normalized = selection ? normalizeSelection(selection) : null;
    const targetCol = normalized?.startCol;
    if (targetCol == null) {
      return;
    }
    applyComponent(component => ({
      ...component,
      dslConfig: {
        ...component.dslConfig,
        tableDsl: {
          ...component.dslConfig.tableDsl!,
          columns: component.dslConfig.tableDsl!.columns.filter((_, index) => index !== targetCol),
          bodyCells: component.dslConfig.tableDsl!.bodyCells
            .filter(cell => cell.colIndex !== targetCol)
            .map(cell => (cell.colIndex > targetCol ? { ...cell, colIndex: cell.colIndex - 1 } : cell)),
          merges: shiftMerges(component.dslConfig.tableDsl!.merges, 'col', targetCol, -1)
        }
      }
    }));
    setSelection(null);
  };

  const resolveStyle = (cell: GridCell) => {
    const styleMap = props.component.dslConfig.tableDsl?.styles ?? {};
    const style = (styleMap[cellStyleKey('body', cell.rowIndex, cell.colIndex)] as TableStyleRule | undefined) ?? {};
    const matched = cell.rowIndex === 0 ? undefined : (props.component.dslConfig.tableDsl?.conditionalFormats ?? []).find(rule => {
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
  };

  const selectWholeRow = (rowIndex: number) => {
    setSelection({
      region: 'body',
      startRow: rowIndex,
      endRow: rowIndex,
      startCol: 0,
      endCol: colCount - 1
    });
  };

  const selectWholeColumn = (colIndex: number) => {
    setSelection({
      region: 'body',
      startRow: 0,
      endRow: rowCount - 1,
      startCol: colIndex,
      endCol: colIndex
    });
  };

  if (!model) {
    return <Empty description="请先选择数据模型" />;
  }

  if (!tableDsl) {
    return <Empty description="表格配置尚未初始化" />;
  }

  const merges = props.component.dslConfig.tableDsl?.merges ?? [];

  return (
    <div
      className={`table-designer-shell ${props.selected ? 'selected' : ''}`}
      onMouseUp={() => setDragging(false)}
    >
      <div className="table-designer-toolbar">
        <Space wrap>
          <Button icon={<InsertRowAboveOutlined />} onClick={() => insertRow('above')}>上方插入行</Button>
          <Button icon={<InsertRowBelowOutlined />} onClick={() => insertRow('below')}>下方插入行</Button>
          <Button icon={<DeleteRowOutlined />} onClick={deleteRow} disabled={!selection}>删除行</Button>
          <Button icon={<ColumnWidthOutlined />} onClick={() => insertColumn('left')}>左侧插入列</Button>
          <Button icon={<ColumnWidthOutlined />} onClick={() => insertColumn('right')}>右侧插入列</Button>
          <Button icon={<DeleteColumnOutlined />} onClick={deleteColumn} disabled={!selection}>删除列</Button>
          <Button icon={<BorderOutlined />} onClick={mergeSelection} disabled={!selection}>合并选中单元格</Button>
          <Button icon={<UngroupOutlined />} onClick={splitSelection} disabled={!selection}>拆分选中单元格</Button>
          <Space size={4}>
            <span className="table-designer-label">单元格颜色</span>
            <input
              className="simple-color-input"
              type="color"
              value={paintColor}
              onChange={event => setPaintColor(event.target.value)}
            />
            <Button onClick={fillSelectedCells} disabled={!selection}>填充颜色</Button>
          </Space>
        </Space>
      </div>

      <div className="table-designer-stage single-pane">
        <div className="table-designer-preview" onMouseLeave={() => setDragging(false)}>
          <table className="designer-grid-table">
            <tbody>
              {Array.from({ length: rowCount }).map((_, rowIndex) => (
                <tr key={`body-row-${rowIndex}`}>
                  {Array.from({ length: colCount }).map((__, colIndex) => {
                    const cell = bodyCells.find(item => item.rowIndex === rowIndex && item.colIndex === colIndex) ?? {
                      key: `body-${rowIndex}-${colIndex}`,
                      region: 'body' as const,
                      rowIndex,
                      colIndex,
                      text: ''
                    };
                    if (shouldHideCell(merges, cell)) {
                      return null;
                    }
                    const span = getCellSpan(merges, cell);
                    const selected = isSelected(selection, cell);
                    const style = resolveStyle(cell);
                    const isEditing = editingCell?.rowIndex === rowIndex && editingCell.colIndex === colIndex;
                    return (
                      <td
                        key={cell.key}
                        rowSpan={span.rowSpan}
                        colSpan={span.colSpan}
                        className={`designer-cell ${selected ? 'selected' : ''}`}
                        style={{
                          background: style.backgroundColor,
                          color: style.color,
                          textAlign: style.textAlign,
                          fontWeight: style.fontWeight
                        }}
                        onMouseDown={event => {
                          event.preventDefault();
                          setDragging(true);
                          setSelection({
                            region: 'body',
                            startRow: rowIndex,
                            endRow: rowIndex,
                            startCol: colIndex,
                            endCol: colIndex
                          });
                        }}
                        onMouseEnter={() => {
                          if (!dragging || !selection) {
                            return;
                          }
                          setSelection(normalizeSelection({
                            ...selection,
                            endRow: rowIndex,
                            endCol: colIndex
                          }));
                        }}
                        onDoubleClick={event => {
                          event.preventDefault();
                          setEditingCell({ rowIndex, colIndex });
                          setEditingValue(cell.text);
                        }}
                      >
                        {isEditing ? (
                          <Input
                            autoFocus
                            size="small"
                            value={editingValue}
                            onChange={event => setEditingValue(event.target.value)}
                            onPressEnter={saveEditing}
                            onBlur={saveEditing}
                          />
                        ) : (
                          <div className="designer-cell-content">
                            {cell.text || <span className="designer-cell-placeholder"> </span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="table-designer-toolbar" style={{ justifyContent: 'space-between' }}>
        <Space wrap>
          <Button onClick={() => selection && selectWholeRow(selection.startRow)} disabled={!selection}>
            选中当前整行
          </Button>
          <Button onClick={() => selection && selectWholeColumn(selection.startCol)} disabled={!selection}>
            选中当前整列
          </Button>
        </Space>
      </div>
    </div>
  );
}
