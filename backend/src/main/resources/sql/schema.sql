DROP TABLE IF EXISTS bi_component;
DROP TABLE IF EXISTS bi_dashboard;
DROP TABLE IF EXISTS bi_dataset_field;
DROP TABLE IF EXISTS bi_dataset_model;
DROP TABLE IF EXISTS bi_template;
DROP TABLE IF EXISTS sales_report_demo;
DROP TABLE IF EXISTS volatility_tracking;

CREATE TABLE IF NOT EXISTS bi_dashboard (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  dashboard_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL,
  published_version INT NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bi_component (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  dashboard_code VARCHAR(64) NOT NULL,
  component_code VARCHAR(64) NOT NULL UNIQUE,
  component_type VARCHAR(32) NOT NULL DEFAULT 'chart',
  title VARCHAR(255) NOT NULL,
  template_code VARCHAR(64) NOT NULL,
  model_code VARCHAR(64) NOT NULL,
  dsl_config_json JSON NOT NULL,
  sort_no INT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bi_dataset_model (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  model_code VARCHAR(64) NOT NULL UNIQUE,
  model_name VARCHAR(255) NOT NULL,
  model_type VARCHAR(32) NOT NULL,
  description VARCHAR(255),
  physical_table_name VARCHAR(64) NOT NULL,
  source_sql TEXT,
  deletable TINYINT(1) NOT NULL DEFAULT 0,
  model_config_json JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bi_dataset_field (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  model_code VARCHAR(64) NOT NULL,
  field_code VARCHAR(64) NOT NULL,
  field_name VARCHAR(128) NOT NULL,
  data_type VARCHAR(32) NOT NULL,
  field_role VARCHAR(32) NOT NULL,
  agg_type VARCHAR(32),
  source_expr VARCHAR(255) NOT NULL,
  calc_type VARCHAR(64),
  base_field_code VARCHAR(64),
  calc_config_json JSON,
  sort_no INT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_model_field (model_code, field_code)
);

CREATE TABLE IF NOT EXISTS bi_template (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  template_code VARCHAR(64) NOT NULL UNIQUE,
  template_name VARCHAR(255) NOT NULL,
  renderer_code VARCHAR(64) NOT NULL,
  description VARCHAR(255),
  capability_json JSON NOT NULL,
  panel_schema_json JSON NOT NULL,
  default_dsl_json JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS volatility_tracking (
  trade_date DATE NOT NULL PRIMARY KEY,
  implied_volatility_median DECIMAL(12, 4) NOT NULL,
  stock_volatility_3m_median DECIMAL(12, 4) NOT NULL,
  stock_volatility_6m_median DECIMAL(12, 4) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_report_demo (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  report_month DATE NOT NULL,
  region VARCHAR(64) NOT NULL,
  desk_name VARCHAR(64) NOT NULL,
  product_line VARCHAR(64) NOT NULL,
  revenue DECIMAL(14, 2) NOT NULL,
  cost DECIMAL(14, 2) NOT NULL,
  profit DECIMAL(14, 2) NOT NULL,
  margin_rate DECIMAL(10, 4) NOT NULL,
  order_count INT NOT NULL,
  customer_count INT NOT NULL
);
