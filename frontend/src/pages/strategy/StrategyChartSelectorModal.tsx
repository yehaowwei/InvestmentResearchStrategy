import { Button, Empty, Input, Modal } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import AppSearchInput from '../../components/AppSearchInput';
import ChartRendererCore from '../../components/ChartRendererCore';
import type { DashboardCategoryKey } from '../../types/dashboard';
import { getCategoryLabel, getDashboardMeta, useDashboardCategories } from '../../utils/dashboardCatalog';
import { normalizeDisplayText } from '../../utils/dashboard';
import type { ChartRuntimeCard } from '../../utils/chartLibrary';

const TEXT = {
  all: '\u5168\u90e8',
  search: '\u641c\u7d22\u6307\u6807\u6216\u7b56\u7565\u540d\u79f0',
  selected: '\u5df2\u9009',
  available: '\u53ef\u9009\u6307\u6807',
  noPreview: '\u5f53\u524d\u6307\u6807\u6682\u65e0\u9884\u89c8',
  noCharts: '\u6ca1\u6709\u7b26\u5408\u6761\u4ef6\u7684\u6307\u6807',
  selectedCount: '\u5df2\u9009\u6307\u6807',
  select: '\u9009\u62e9',
  selectedAction: '\u5df2\u9009\u4e2d',
  name: '\u7b56\u7565\u540d\u79f0',
  cancel: '\u53d6\u6d88'
} as const;

function chartIdOf(card: ChartRuntimeCard) {
  return `${card.chartCode}:${card.component.componentCode}`;
}

export default function StrategyChartSelectorModal(props: {
  open: boolean;
  title: string;
  charts: ChartRuntimeCard[];
  selectedChartIds: string[];
  confirmText: string;
  confirmDisabled?: boolean;
  onToggle: (chartId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  nameValue?: string;
  namePlaceholder?: string;
  onNameChange?: (value: string) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<'all' | DashboardCategoryKey>('all');
  const categories = useDashboardCategories();

  useEffect(() => {
    if (!props.open) {
      setKeyword('');
      setCategory('all');
    }
  }, [props.open]);

  const filteredCharts = useMemo(() => props.charts.filter(card => {
    const nextChartId = chartIdOf(card);
    const inCategory = category === 'all' || getDashboardMeta(card.chartCode).category === category;
    if (!inCategory) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const normalizedKeyword = keyword.trim().toLowerCase();
    return [
      normalizeDisplayText(card.chartName, card.chartCode),
      normalizeDisplayText(card.component.dslConfig.visualDsl.title || card.component.title, card.component.componentCode),
      card.chartCode,
      card.component.componentCode,
      nextChartId
    ].some(value => value.toLowerCase().includes(normalizedKeyword));
  }), [category, keyword, props.charts]);

  return (
    <Modal
      title={props.title}
      open={props.open}
      onCancel={props.onCancel}
      width="92vw"
      footer={[
        <Button key="cancel" onClick={props.onCancel}>
          {TEXT.cancel}
        </Button>,
        <Button key="confirm" type="primary" onClick={props.onConfirm} disabled={props.confirmDisabled}>
          {props.confirmText}
        </Button>
      ]}
      styles={{ body: { maxHeight: '76vh', overflow: 'auto', padding: 16 } }}
    >
      <div className="strategy-manage-sections">
        {props.onNameChange ? (
          <section className="strategy-manage-block">
            <div className="strategy-info-row">
              <span className="strategy-selection-title">{TEXT.name}</span>
              <Input
                value={props.nameValue}
                placeholder={props.namePlaceholder}
                onChange={event => props.onNameChange?.(event.target.value)}
              />
            </div>
          </section>
        ) : null}

        <section className="strategy-manage-block">
          <div className="strategy-manage-header">
            <span className="strategy-selection-title">{TEXT.available}</span>
            <span className="strategy-selection-count">
              {TEXT.selectedCount} {props.selectedChartIds.length}
            </span>
          </div>
          <div className="favorites-filter-nav" style={{ marginBottom: 0 }}>
            <Button
              type={category === 'all' ? 'primary' : 'default'}
              onClick={() => setCategory('all')}
            >
              {TEXT.all}
            </Button>
            {categories.map(item => (
              <Button
                key={item.key}
                type={category === item.key ? 'primary' : 'default'}
                onClick={() => setCategory(item.key)}
              >
                {item.label}
              </Button>
            ))}
            <AppSearchInput
              allowClear
              placeholder={TEXT.search}
              style={{ width: 240, marginLeft: 'auto' }}
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
            />
          </div>

          {filteredCharts.length > 0 ? (
            <div className="favorites-board-grid strategy-config-grid">
              {filteredCharts.map(card => {
                const chartId = chartIdOf(card);
                const selected = props.selectedChartIds.includes(chartId);
                return (
                  <article
                    key={chartId}
                    className={`panel-card favorites-board-card public-board-card strategy-picker-card${selected ? ' strategy-picker-card-selected' : ''}`}
                  >
                    <div className="favorites-board-card-head">
                      <div>
                        <h3 className="favorites-board-title">
                          {normalizeDisplayText(card.component.dslConfig.visualDsl.title || card.component.title, card.component.componentCode)}
                        </h3>
                        <div className="favorites-board-meta">
                          <span>{getCategoryLabel(getDashboardMeta(card.chartCode).category)}</span>
                          <span>{normalizeDisplayText(card.chartName, card.chartCode)}</span>
                        </div>
                      </div>
                      <div className="favorites-card-actions public-chart-card-actions">
                        <Button type={selected ? 'default' : 'primary'} onClick={() => props.onToggle(chartId)}>
                          {selected ? TEXT.selectedAction : TEXT.select}
                        </Button>
                      </div>
                    </div>
                    <div className="favorites-board-thumb">
                      <div className="library-chart-preview">
                        <div className="library-chart-preview-head">
                          {normalizeDisplayText(card.component.dslConfig.visualDsl.indicatorTag) ? (
                            <span className="chart-card-tag">
                              {normalizeDisplayText(card.component.dslConfig.visualDsl.indicatorTag)}
                            </span>
                          ) : null}
                        </div>
                        <div className="library-chart-preview-body">
                          {card.preview ? (
                            <ChartRendererCore
                              component={card.component}
                              preview={card.preview}
                              templateCode={card.component.templateCode}
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
              })}
            </div>
          ) : (
            <div className="panel-card canvas-card canvas-empty">
              <Empty description={TEXT.noCharts} />
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}
