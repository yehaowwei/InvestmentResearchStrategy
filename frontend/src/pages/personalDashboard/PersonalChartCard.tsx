import { DeleteOutlined, ExpandOutlined, HolderOutlined } from '@ant-design/icons';
import { Button, Empty, Popconfirm } from 'antd';
import type { ChartPreview } from '../../types/dashboard';
import ChartRendererCore from '../../components/ChartRendererCore';
import { normalizeDisplayText } from '../../utils/dashboard';
import type { PersonalChartEntry } from '../../utils/favorites';
import { toComponent } from './helpers';

export default function PersonalChartCard(props: {
  item: PersonalChartEntry;
  preview?: ChartPreview;
  dragging: boolean;
  dragOver: boolean;
  sortMode: 'manual' | 'time_asc' | 'time_desc';
  onExpand: () => void;
  onSortStart: (event: React.MouseEvent<HTMLElement>, boardId: string) => void;
  onRemove: () => void;
}) {
  const { item } = props;
  return (
    <article
      id={`personal-chart-card-${item.chart.componentCode}`}
      data-sort-id={item.boardId}
      className={`panel-card favorites-board-card public-board-card personal-board-card personal-chart-card${props.dragging ? ' personal-chart-card-dragging' : ''}${props.dragOver ? ' drag-preview-target' : ''}`}
    >
      <div className="favorites-board-card-head">
        <div>
          <h3 className="favorites-board-title">
            {normalizeDisplayText(item.chart.componentTitle, item.chart.componentCode)}
          </h3>
          <div className="favorites-board-meta">
            <span>{item.primaryLabel}</span>
            <span>{item.secondaryLabel}</span>
            <span>排序 {item.order}</span>
          </div>
        </div>
        <div className="favorites-card-actions public-chart-card-actions personal-chart-card-actions">
          <Button icon={<ExpandOutlined />} onClick={props.onExpand}>
            放大查看
          </Button>
          <span
            className={`drag-handle-chip${props.sortMode !== 'manual' ? ' disabled' : ''}`}
            onMouseDown={event => props.onSortStart(event, item.boardId)}
          >
            <HolderOutlined />
            <span>拖拽排序</span>
          </span>
          <Popconfirm title="确认删除当前图表吗？" okText="确认" cancelText="取消" onConfirm={props.onRemove}>
            <Button icon={<DeleteOutlined />} danger>
              删除
            </Button>
          </Popconfirm>
        </div>
      </div>
      <div className="favorites-board-thumb">
        <div className="library-chart-preview">
          <div className="library-chart-preview-head">
            {normalizeDisplayText(item.chart.dslConfig.visualDsl.indicatorTag) ? (
              <span className="chart-card-tag">
                {normalizeDisplayText(item.chart.dslConfig.visualDsl.indicatorTag)}
              </span>
            ) : null}
          </div>
          <div className="library-chart-preview-body">
            {props.preview ? (
              <ChartRendererCore
                component={toComponent(item)}
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
                          <Empty description="当前图表暂无预览" />
                        )}
                      </div>
                    </div>
      </div>
    </article>
  );
}
