DELETE FROM bi_dataset_field WHERE model_code = 'sales_report_pool';
DELETE FROM bi_dataset_model WHERE model_code = 'sales_report_pool';
INSERT INTO bi_dataset_model(model_code, model_name, model_type, description, physical_table_name, source_sql, deletable, model_config_json) VALUES
('sales_report_pool', 'Sales Report Demo Pool', 'SOURCE_TABLE', 'Sample dataset for validating the table report designer', 'sales_report_demo', 'SELECT * FROM sales_report_demo', 0, '{"mainTable":{"table":"sales_report_demo","alias":"sr"},"joinTables":[],"sourceKind":"SOURCE_TABLE"}');
INSERT INTO bi_dataset_field(model_code, field_code, field_name, data_type, field_role, agg_type, source_expr, sort_no) VALUES
('sales_report_pool', 'report_month', 'Report Month', 'date', 'dimension', NULL, 'sr.report_month', 1),
('sales_report_pool', 'region', 'Region', 'string', 'dimension', NULL, 'sr.region', 2),
('sales_report_pool', 'desk_name', 'Desk', 'string', 'dimension', NULL, 'sr.desk_name', 3),
('sales_report_pool', 'product_line', 'Product Line', 'string', 'dimension', NULL, 'sr.product_line', 4),
('sales_report_pool', 'revenue', 'Revenue', 'number', 'metric', 'sum', 'sr.revenue', 10),
('sales_report_pool', 'cost', 'Cost', 'number', 'metric', 'sum', 'sr.cost', 11),
('sales_report_pool', 'profit', 'Profit', 'number', 'metric', 'sum', 'sr.profit', 12),
('sales_report_pool', 'margin_rate', 'Margin Rate', 'number', 'metric', 'avg', 'sr.margin_rate', 13),
('sales_report_pool', 'order_count', 'Order Count', 'number', 'metric', 'sum', 'sr.order_count', 14),
('sales_report_pool', 'customer_count', 'Customer Count', 'number', 'metric', 'sum', 'sr.customer_count', 15);
