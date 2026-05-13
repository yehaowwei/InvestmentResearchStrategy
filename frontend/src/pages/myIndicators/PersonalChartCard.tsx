import { DeleteOutlined, ExpandOutlined, HolderOutlined } from '@ant-design/icons';
import { Button, Empty, Popconfirm } from 'antd';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ChartPreview } from '../../types/dashboard';
import ChartRendererCore from '../../components/ChartRendererCore';
import { normalizeDisplayText } from '../../utils/dashboard';
import type { PersonalChartEntry } from '../../utils/favorites';
import { toComponent } from './helpers';

const TEXT = {
  enlarge: '\u653e\u5927\u67e5\u770b',
  delete: '\u5220\u9664',
  deleteConfirm: '\u786e\u8ba4\u5220\u9664\u5f53\u524d\u6307\u6807\u5417\uff1f',
  confirm: '\u786e\u8ba4',
  cancel: '\u53d6\u6d88',
  noPreview: '\u5f53\u524d\u6307\u6807\u6682\u65e0\u9884\u89c8'
} as const;

export default function PersonalChartCard(props: {
  item: PersonalChartEntry;
  preview?: ChartPreview;
  dragging: boolean;
  dragOver: boolean;
  onExpand: () => void;
  onSortStart: (event: ReactMouseEvent<HTMLElement>, boardId: string) => void;
  onRemove: () => void;
}) {
  const { item } = props;
  const component = toComponent(item);
  const canRenderPreview = Boolean(props.preview) || component.templateCode === 'table' || component.componentType === 'table';

  return (
    <article
      id={`personal-chart-card-${item.chart.componentCode}`}
      data-sort-id={item.boardId}
      className={`panel-card favorites-board-card public-board-card personal-board-card personal-chart-card personal-chart-card-sortable${props.dragging ? ' personal-chart-card-dragging' : ''}${props.dragOver ? ' drag-preview-target' : ''}`}
    >
      <div className="favorites-board-card-head">
        <div>
          <h3 className="favorites-board-title">
            {normalizeDisplayText(item.chart.componentTitle, item.chart.componentCode)}
          </h3>
        </div>
        <div className="favorites-card-actions public-chart-card-actions personal-chart-card-actions">
          <Button
            className="thumbnail-drag-button"
            icon={<HolderOutlined />}
            title="拖拽排序"
            aria-label="拖拽排序"
            onMouseDown={event => props.onSortStart(event, item.boardId)}
          >
            拖拽
          </Button>
          <Button icon={<ExpandOutlined />} onClick={props.onExpand}>
            {TEXT.enlarge}
          </Button>
          <Popconfirm title={TEXT.deleteConfirm} okText={TEXT.confirm} cancelText={TEXT.cancel} onConfirm={props.onRemove}>
            <Button icon={<DeleteOutlined />} danger>
              {TEXT.delete}
            </Button>
          </Popconfirm>
        </div>
      </div>
        <div className="favorites-board-thumb">
          <div className="library-chart-preview">
            <div className="library-chart-preview-body">
            {canRenderPreview ? (
              <ChartRendererCore
                component={component}
                preview={props.preview}
                templateCode={item.chart.templateCode}
                viewMode="chart"
                editable={false}
                selected={false}
                thumbnail
                compact={false}
                dense
              />
            ) : (
              <Empty description={TEXT.noPreview} />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
