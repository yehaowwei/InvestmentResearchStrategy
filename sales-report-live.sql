CREATE TABLE IF NOT EXISTS sales_report_demo (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  report_month DATE NOT NULL,
  region VARCHAR(64) NOT NULL,
  desk_name VARCHAR(64) NOT NULL,
  product_line VARCHAR(64) NOT NULL,
  revenue DECIMAL(14,2) NOT NULL,
  cost DECIMAL(14,2) NOT NULL,
  profit DECIMAL(14,2) NOT NULL,
  margin_rate DECIMAL(10,4) NOT NULL,
  order_count INT NOT NULL,
  customer_count INT NOT NULL
);
DELETE FROM sales_report_demo;
INSERT INTO sales_report_demo(report_month, region, desk_name, product_line, revenue, cost, profit, margin_rate, order_count, customer_count) VALUES
('2026-01-01', '华东', '机构业务', '期权做市', 1280000.00, 930000.00, 350000.00, 0.2734, 142, 28),
('2026-01-01', '华东', '机构业务', '波动率策略', 980000.00, 640000.00, 340000.00, 0.3469, 118, 21),
('2026-01-01', '华南', '财富管理', '固收增强', 760000.00, 510000.00, 250000.00, 0.3289, 97, 34),
('2026-01-01', '华北', '量化业务', '指数增强', 1120000.00, 810000.00, 310000.00, 0.2768, 126, 19),
('2026-02-01', '华东', '机构业务', '期权做市', 1350000.00, 960000.00, 390000.00, 0.2889, 151, 29),
('2026-02-01', '华东', '机构业务', '波动率策略', 1010000.00, 672000.00, 338000.00, 0.3347, 123, 23),
('2026-02-01', '华南', '财富管理', '固收增强', 815000.00, 548000.00, 267000.00, 0.3276, 103, 36),
('2026-02-01', '华北', '量化业务', '指数增强', 1185000.00, 844000.00, 341000.00, 0.2878, 132, 20),
('2026-03-01', '华东', '机构业务', '期权做市', 1415000.00, 997000.00, 418000.00, 0.2954, 158, 31),
('2026-03-01', '华东', '机构业务', '波动率策略', 1088000.00, 704000.00, 384000.00, 0.3529, 129, 24),
('2026-03-01', '华南', '财富管理', '固收增强', 846000.00, 563000.00, 283000.00, 0.3345, 106, 38),
('2026-03-01', '华北', '量化业务', '指数增强', 1218000.00, 859000.00, 359000.00, 0.2947, 137, 22);
DELETE FROM bi_dataset_field WHERE model_code = 'sales_report_pool';
DELETE FROM bi_dataset_model WHERE model_code = 'sales_report_pool';
INSERT INTO bi_dataset_model(model_code, model_name, model_type, description, physical_table_name, source_sql, deletable, model_config_json) VALUES
('sales_report_pool', '销售报表样例数据池', 'SOURCE_TABLE', '用于验证报表表格设计器的样例数据', 'sales_report_demo', 'SELECT * FROM sales_report_demo', 0, '{"mainTable":{"table":"sales_report_demo","alias":"sr"},"joinTables":[],"sourceKind":"SOURCE_TABLE"}');
INSERT INTO bi_dataset_field(model_code, field_code, field_name, data_type, field_role, agg_type, source_expr, sort_no) VALUES
('sales_report_pool', 'report_month', '报表月份', 'date', 'dimension', NULL, 'sr.report_month', 1),
('sales_report_pool', 'region', '大区', 'string', 'dimension', NULL, 'sr.region', 2),
('sales_report_pool', 'desk_name', '业务条线', 'string', 'dimension', NULL, 'sr.desk_name', 3),
('sales_report_pool', 'product_line', '产品线', 'string', 'dimension', NULL, 'sr.product_line', 4),
('sales_report_pool', 'revenue', '收入', 'number', 'metric', 'sum', 'sr.revenue', 10),
('sales_report_pool', 'cost', '成本', 'number', 'metric', 'sum', 'sr.cost', 11),
('sales_report_pool', 'profit', '利润', 'number', 'metric', 'sum', 'sr.profit', 12),
('sales_report_pool', 'margin_rate', '毛利率', 'number', 'metric', 'avg', 'sr.margin_rate', 13),
('sales_report_pool', 'order_count', '订单数', 'number', 'metric', 'sum', 'sr.order_count', 14),
('sales_report_pool', 'customer_count', '客户数', 'number', 'metric', 'sum', 'sr.customer_count', 15);
