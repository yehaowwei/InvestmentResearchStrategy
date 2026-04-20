INSERT INTO bi_dataset_model(
  model_code, model_name, model_type, description, physical_table_name, source_sql, deletable, model_config_json
) VALUES
('volatility_tracking_pool', '波动率跟踪源数据', 'SOURCE_TABLE', '基于 volatility_tracking 源表的数据池，源数据池不可删除。', 'volatility_tracking', 'SELECT * FROM volatility_tracking', 0,
 '{"mainTable":{"table":"volatility_tracking","alias":"vt"},"joinTables":[],"sourceKind":"SOURCE_TABLE"}');

INSERT INTO bi_dataset_field(model_code, field_code, field_name, data_type, field_role, agg_type, source_expr, sort_no) VALUES
('volatility_tracking_pool', 'trade_date', '交易日期', 'date', 'attribute', NULL, 'vt.trade_date', 1),
('volatility_tracking_pool', 'implied_volatility_median', '隐含波动率中位数', 'number', 'attribute', NULL, 'vt.implied_volatility_median', 10),
('volatility_tracking_pool', 'stock_volatility_3m_median', '正股 3M 波动率中位数', 'number', 'attribute', NULL, 'vt.stock_volatility_3m_median', 11),
('volatility_tracking_pool', 'stock_volatility_6m_median', '正股 6M 波动率中位数', 'number', 'attribute', NULL, 'vt.stock_volatility_6m_median', 12);

INSERT INTO bi_dataset_field(model_code, field_code, field_name, data_type, field_role, agg_type, source_expr, calc_type, base_field_code, calc_config_json, sort_no) VALUES
('volatility_tracking_pool', 'implied_volatility_3y_avg', '隐含波动率滚动三年平均值', 'number', 'attribute', NULL, 'vt.implied_volatility_median', 'rolling_3y_avg', 'implied_volatility_median', '{"windowRows":755}', 20);

INSERT INTO bi_template(template_code, template_name, renderer_code, description, capability_json, panel_schema_json, default_dsl_json) VALUES
('mixed', '混合趋势图', 'cartesian_combo', '折线、面积、柱状组合趋势图。',
'{"renderer":"cartesian_combo","chartTypes":["line","area","bar"],"dimensionCount":{"min":1,"max":2},"metricCount":{"min":1,"max":8},"seriesFieldCount":{"min":0,"max":2},"supportsMultiTableModel":true}',
'{"sections":[]}',
'{"queryDsl":{"modelCode":"volatility_tracking_pool","dimensionField":"","dimensionFields":[],"seriesFields":[],"metrics":[],"filters":[],"orders":[],"limit":500},"visualDsl":{"title":"混合趋势图","subtitle":"","xAxisName":"","leftAxisName":"","rightAxisName":""},"styleDsl":{"showSymbol":false,"lineWidth":2,"areaOpacity":0.22},"interactionDsl":{"tooltip":true,"legend":true,"dataZoom":true},"layout":{"x":0,"y":0,"w":12,"h":9}}'),
('line', '折线趋势图', 'cartesian_combo', '用于时间序列趋势展示。',
'{"renderer":"cartesian_combo","chartTypes":["line","area"],"dimensionCount":{"min":1,"max":2},"metricCount":{"min":1,"max":8},"seriesFieldCount":{"min":0,"max":2},"supportsMultiTableModel":true}',
'{"sections":[]}',
'{"queryDsl":{"modelCode":"volatility_tracking_pool","dimensionField":"","dimensionFields":[],"seriesFields":[],"metrics":[],"filters":[],"orders":[],"limit":500},"visualDsl":{"title":"折线趋势图","subtitle":"","xAxisName":"","leftAxisName":"","rightAxisName":""},"styleDsl":{"showSymbol":false,"lineWidth":2,"areaOpacity":0.2},"interactionDsl":{"tooltip":true,"legend":true,"dataZoom":true},"layout":{"x":0,"y":0,"w":12,"h":8}}'),
('bar', '柱状对比图', 'cartesian_combo', '用于分类对比和分组对比。',
'{"renderer":"cartesian_combo","chartTypes":["bar"],"dimensionCount":{"min":1,"max":2},"metricCount":{"min":1,"max":8},"seriesFieldCount":{"min":0,"max":2},"supportsMultiTableModel":true}',
'{"sections":[]}',
'{"queryDsl":{"modelCode":"volatility_tracking_pool","dimensionField":"","dimensionFields":[],"seriesFields":[],"metrics":[],"filters":[],"orders":[],"limit":500},"visualDsl":{"title":"柱状对比图","subtitle":"","xAxisName":"","leftAxisName":"","rightAxisName":""},"styleDsl":{"showSymbol":false,"lineWidth":2,"areaOpacity":0.2},"interactionDsl":{"tooltip":true,"legend":true,"dataZoom":true},"layout":{"x":0,"y":0,"w":12,"h":8}}'),
('scatter', '散点图', 'scatter_quadrant', '用于观察两个数值字段之间的关系。',
'{"renderer":"scatter_quadrant","chartTypes":["scatter"],"dimensionCount":{"min":1,"max":1},"metricCount":{"min":2,"max":2},"seriesFieldCount":{"min":0,"max":1},"supportsMultiTableModel":true}',
'{"sections":[]}',
'{"queryDsl":{"modelCode":"volatility_tracking_pool","dimensionField":"","dimensionFields":[],"seriesFields":[],"metrics":[],"filters":[],"orders":[],"limit":500},"visualDsl":{"title":"散点图","subtitle":"","xAxisName":"","leftAxisName":"","rightAxisName":""},"styleDsl":{"showSymbol":true,"lineWidth":2,"areaOpacity":0.2},"interactionDsl":{"tooltip":true,"legend":true,"dataZoom":true},"layout":{"x":0,"y":0,"w":12,"h":9}}'),
('pie', '饼图', 'pie', '用于单数值字段构成展示。',
'{"renderer":"pie","chartTypes":["pie"],"dimensionCount":{"min":1,"max":1},"metricCount":{"min":1,"max":1},"seriesFieldCount":{"min":0,"max":0},"supportsMultiTableModel":true}',
'{"sections":[]}',
'{"queryDsl":{"modelCode":"volatility_tracking_pool","dimensionField":"","dimensionFields":[],"seriesFields":[],"metrics":[],"filters":[],"orders":[],"limit":20},"visualDsl":{"title":"饼图","subtitle":"","xAxisName":"","leftAxisName":"","rightAxisName":""},"styleDsl":{"showSymbol":false,"lineWidth":2,"areaOpacity":0.2},"interactionDsl":{"tooltip":true,"legend":true,"dataZoom":false},"layout":{"x":0,"y":0,"w":6,"h":8}}');

INSERT INTO bi_dashboard(dashboard_code, name, status, published_version) VALUES
('volatility_tracking_dashboard', '波动率跟踪看板', 'PUBLISHED', 1);

INSERT INTO bi_component(dashboard_code, component_code, component_type, title, template_code, model_code, dsl_config_json, sort_no) VALUES
('volatility_tracking_dashboard', 'cmp-volatility-trend', 'chart', '波动率跟踪分析', 'mixed', 'volatility_tracking_pool',
'{"queryDsl":{"modelCode":"volatility_tracking_pool","dimensionField":"","dimensionFields":[],"seriesFields":[],"metrics":[],"filters":[],"orders":[],"limit":500},"visualDsl":{"title":"波动率跟踪分析","subtitle":"","xAxisName":"","leftAxisName":"","rightAxisName":""},"styleDsl":{"showSymbol":false,"lineWidth":2,"areaOpacity":0.22},"interactionDsl":{"tooltip":true,"legend":true,"dataZoom":true},"layout":{"x":0,"y":0,"w":12,"h":9}}', 1);
