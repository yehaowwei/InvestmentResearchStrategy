import { Button, Empty, Input, Modal } from 'antd';
import ChartRendererCore from '../../components/ChartRendererCore';
import { DASHBOARD_CATEGORIES } from '../../utils/dashboardCatalog';
import { normalizeDisplayText } from '../../utils/dashboard';
import type { DashboardCategoryKey } from '../../types/dashboard';
import type { AvailableChartCard } from './helpers';

export default function AddChartModal(props: {
  open: boolean;
  loading: boolean;
  category: 'all' | DashboardCategoryKey;
  keyword: string;
  groups: Array<{ key: string; label: string; charts: AvailableChartCard[] }>;
  onClose: () => void;
  onCategoryChange: (value: 'all' | DashboardCategoryKey) => void;
  onKeywordChange: (value: string) => void;
  onAdd: (item: AvailableChartCard) => void;
}) {
  return (
    <Modal
      title="增加图表"
      open={props.open}
      footer={null}
      onCancel={props.onClose}
      width="90vw"
      styles={{ body: { maxHeight: '78vh', overflow: 'auto', padding: 16 } }}
    >
      <div className="favorites-filter-nav" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Button type={props.category === 'all' ? 'primary' : 'default'} onClick={() => props.onCategoryChange('all')}>
          鍏ㄩ儴
        </Button>
        {DASHBOARD_CATEGORIES.map(option => (
          <Button
            key={`add-${option.key}`}
            type={props.category === option.key ? 'primary' : 'default'}
            onClick={() => props.onCategoryChange(option.key)}
          >
            {option.label}
          </Button>
        ))}
        <Input.Search
          allowClear
          placeholder="搜索未收藏图表名称"
          style={{ width: 260 }}
          value={props.keyword}
          onChange={event => props.onKeywordChange(event.target.value)}
        />
      </div>
      {props.groups.length > 0 ? (
        <div>
          {props.groups.map(group => (
            <div key={group.key} style={{ marginBottom: 24 }}>
              {props.category === 'all' ? (
                <div className="runtime-toc-title" style={{ marginBottom: 12 }}>{group.label}</div>
              ) : null}
              <div className="favorites-board-grid public-chart-grid">
                {group.charts.map(item => (
                  <article key={`${group.key}:${item.component.componentCode}`} className="panel-card favorites-board-card public-board-card">
                    <div className="favorites-board-card-head">
                      <div>
                        <h3 className="favorites-board-title">
                          {normalizeDisplayText(
                            item.component.dslConfig.visualDsl.title || item.component.title,
                            item.component.componentCode
                          )}
                        </h3>
                        <div className="favorites-board-meta" />
                      </div>
                      <div className="favorites-card-actions public-chart-card-actions">
                        <Button type="primary" onClick={() => props.onAdd(item)}>
                          加入我的指标
                        </Button>
                      </div>
                    </div>
                    <div className="favorites-board-thumb">
                      <div className="library-chart-preview">
                        <div className="library-chart-preview-head">
                          {normalizeDisplayText(item.component.dslConfig.visualDsl.indicatorTag) ? (
                            <span className="chart-card-tag">
                              {normalizeDisplayText(item.component.dslConfig.visualDsl.indicatorTag)}
                            </span>
                          ) : null}
                        </div>
                        <div className="library-chart-preview-body">
                          {item.preview ? (
                            <ChartRendererCore
                              component={item.component}
                              preview={item.preview}
                              templateCode={item.component.templateCode}
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
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel-card canvas-card canvas-empty">
          <Empty description={props.loading ? '正在加载可添加图表' : '当前没有可添加的未收藏图表'} />
        </div>
      )}
    </Modal>
  );
}
