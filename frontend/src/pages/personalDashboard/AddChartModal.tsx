import { Button, Empty, Input, Modal } from 'antd';
import ChartRendererCore from '../../components/ChartRendererCore';
import type { DashboardCategoryKey } from '../../types/dashboard';
import { DASHBOARD_CATEGORIES } from '../../utils/dashboardCatalog';
import { normalizeDisplayText } from '../../utils/dashboard';
import type { AvailableChartCard } from './helpers';

const TEXT = {
  title: '\u65b0\u589e\u6307\u6807',
  all: '\u5168\u90e8',
  searchPlaceholder: '\u641c\u7d22\u672a\u6536\u85cf\u56fe\u8868\u540d\u79f0',
  addButton: '\u52a0\u5165\u6211\u7684\u6307\u6807',
  emptyPreview: '\u5f53\u524d\u56fe\u8868\u6682\u65e0\u9884\u89c8',
  loading: '\u6b63\u5728\u52a0\u8f7d\u53ef\u6dfb\u52a0\u56fe\u8868',
  emptyAvailable: '\u5f53\u524d\u6ca1\u6709\u53ef\u6dfb\u52a0\u7684\u672a\u6536\u85cf\u56fe\u8868'
} as const;

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
      title={TEXT.title}
      open={props.open}
      footer={null}
      onCancel={props.onClose}
      width="90vw"
      styles={{ body: { maxHeight: '78vh', overflow: 'auto', padding: 16 } }}
    >
      <div
        className="favorites-filter-nav"
        style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}
      >
        <Button type={props.category === 'all' ? 'primary' : 'default'} onClick={() => props.onCategoryChange('all')}>
          {TEXT.all}
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
          placeholder={TEXT.searchPlaceholder}
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
                <div className="runtime-toc-title" style={{ marginBottom: 12 }}>
                  {group.label}
                </div>
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
                          {TEXT.addButton}
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
                            <Empty description={TEXT.emptyPreview} />
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
          <Empty description={props.loading ? TEXT.loading : TEXT.emptyAvailable} />
        </div>
      )}
    </Modal>
  );
}
