-- MySQL schema for the strategy workspace seed data.
SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS `dashboard_definition` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `dashboard_code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `published_version` INT NOT NULL,
  `created_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dashboard_definition_1` (`dashboard_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dashboard_component` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `dashboard_code` VARCHAR(64) NOT NULL,
  `component_code` VARCHAR(64) NOT NULL,
  `component_type` VARCHAR(32) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `template_code` VARCHAR(64) NOT NULL,
  `model_code` VARCHAR(64) NOT NULL,
  `dsl_config_json` LONGTEXT NOT NULL,
  `sort_no` INT NOT NULL,
  `created_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dashboard_component_1` (`component_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dataset_model` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `model_code` VARCHAR(64) NOT NULL,
  `model_name` VARCHAR(255) NOT NULL,
  `model_type` VARCHAR(32) NOT NULL,
  `description` VARCHAR(255),
  `physical_table_name` VARCHAR(64) NOT NULL,
  `source_sql` LONGTEXT,
  `deletable` TINYINT(1) NOT NULL,
  `model_config_json` LONGTEXT NOT NULL,
  `created_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dataset_model_1` (`model_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `dataset_field` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `model_code` VARCHAR(64) NOT NULL,
  `field_code` VARCHAR(64) NOT NULL,
  `field_name` VARCHAR(128) NOT NULL,
  `data_type` VARCHAR(32) NOT NULL,
  `field_role` VARCHAR(32) NOT NULL,
  `agg_type` VARCHAR(32),
  `source_expr` VARCHAR(255) NOT NULL,
  `calc_type` VARCHAR(64),
  `base_field_code` VARCHAR(64),
  `calc_config_json` LONGTEXT,
  `sort_no` INT NOT NULL,
  `created_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dataset_field_1` (`model_code`, `field_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `chart_template` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `template_code` VARCHAR(64) NOT NULL,
  `template_name` VARCHAR(255) NOT NULL,
  `renderer_code` VARCHAR(64) NOT NULL,
  `description` VARCHAR(255),
  `capability_json` LONGTEXT NOT NULL,
  `panel_schema_json` LONGTEXT NOT NULL,
  `default_dsl_json` LONGTEXT NOT NULL,
  `created_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_chart_template_1` (`template_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shanghai_50_equity_risk_premium` (
  `trade_date` DATE NOT NULL,
  `equity_risk_premium` DECIMAL(12, 2) NOT NULL,
  `benchmark_index_level` DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (`trade_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `wind_all_a_equity_risk_premium` (
  `trade_date` DATE NOT NULL,
  `equity_risk_premium` DECIMAL(12, 2) NOT NULL,
  `benchmark_index_level` DECIMAL(12, 2) NOT NULL,
  PRIMARY KEY (`trade_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `monthly_sales_report` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `report_month` DATE NOT NULL,
  `sales_region` VARCHAR(64) NOT NULL,
  `business_desk_name` VARCHAR(64) NOT NULL,
  `product_line` VARCHAR(64) NOT NULL,
  `revenue_amount` DECIMAL(14, 2) NOT NULL,
  `cost_amount` DECIMAL(14, 2) NOT NULL,
  `profit_amount` DECIMAL(14, 2) NOT NULL,
  `margin_rate` DECIMAL(10, 4) NOT NULL,
  `order_count` INT NOT NULL,
  `customer_count` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `weekly_market_financing_balance` (
  `trade_date` DATE NOT NULL,
  `weekly_financing_net_change` DECIMAL(12, 2),
  `financing_balance_amount` DECIMAL(12, 2),
  PRIMARY KEY (`trade_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `weekly_sector_financing_change` (
  `sector_name` VARCHAR(13) NOT NULL,
  `financing_balance_change_2026_02_13` DECIMAL(12, 2),
  `financing_balance_change_2026_02_27` DECIMAL(12, 2),
  `financing_balance_change_2026_03_06` DECIMAL(12, 2),
  `financing_balance_change_2026_03_13` DECIMAL(12, 2),
  `financing_balance_change_2026_03_20` DECIMAL(12, 2),
  `financing_balance_change_2026_03_27` DECIMAL(12, 2),
  PRIMARY KEY (`sector_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shared_state` (
  `state_key` VARCHAR(128) NOT NULL,
  `state_json` LONGTEXT NOT NULL,
  `updated_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`state_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

