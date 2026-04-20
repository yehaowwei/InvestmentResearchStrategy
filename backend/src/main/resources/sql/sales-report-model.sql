INSERT INTO bi_dataset_model(model_code, model_name, model_type, description, physical_table_name, source_sql, deletable, model_config_json) VALUES
('sales_report_pool', '销售报表示例数据池', 'SOURCE_TABLE', '用于验证表格报表设计器的中文示例数据集', 'sales_report_demo', 'SELECT * FROM sales_report_demo', 0,
'{"mainTable":{"table":"sales_report_demo","alias":"sr"},"joinTables":[],"sourceKind":"SOURCE_TABLE"}');

INSERT INTO bi_dataset_field(model_code, field_code, field_name, data_type, field_role, agg_type, source_expr, sort_no) VALUES
('sales_report_pool', 'report_month', '报表月份', 'date', 'dimension', NULL, 'sr.report_month', 1),
('sales_report_pool', 'region', '区域', 'string', 'dimension', NULL, 'sr.region', 2),
('sales_report_pool', 'desk_name', '业务条线', 'string', 'dimension', NULL, 'sr.desk_name', 3),
('sales_report_pool', 'product_line', '产品线', 'string', 'dimension', NULL, 'sr.product_line', 4),
('sales_report_pool', 'revenue', '收入', 'number', 'metric', 'sum', 'sr.revenue', 10),
('sales_report_pool', 'cost', '成本', 'number', 'metric', 'sum', 'sr.cost', 11),
('sales_report_pool', 'profit', '利润', 'number', 'metric', 'sum', 'sr.profit', 12),
('sales_report_pool', 'margin_rate', '利润率', 'number', 'metric', 'avg', 'sr.margin_rate', 13),
('sales_report_pool', 'order_count', '订单数', 'number', 'metric', 'sum', 'sr.order_count', 14),
('sales_report_pool', 'customer_count', '客户数', 'number', 'metric', 'sum', 'sr.customer_count', 15);
