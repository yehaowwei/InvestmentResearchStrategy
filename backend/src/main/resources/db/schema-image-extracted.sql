-- Tables extracted from the uploaded strategy research images.
SET NAMES utf8mb4;
SET time_zone = '+08:00';

CREATE TABLE IF NOT EXISTS `macro_industry_inflation_pulse_monthly` (
  `observation_month` DATE NOT NULL,
  `industrial_value_added_yoy` DECIMAL(8, 2),
  `composite_inflation_rate` DECIMAL(8, 2),
  `nanhua_china_credit_impulse_index` DECIMAL(8, 2),
  PRIMARY KEY (`observation_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `macro_state_trend_matrix` (
  `state_code` VARCHAR(16) NOT NULL,
  `m1_yoy_trend` TINYINT NOT NULL,
  `nanhua_industrial_index_trend` TINYINT NOT NULL,
  `china_10y_bond_yield_trend` TINYINT NOT NULL,
  PRIMARY KEY (`state_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `macro_pmi_bond_industrial_cycle_monthly` (
  `observation_month` DATE NOT NULL,
  `m1_yoy` DECIMAL(8, 2),
  `china_10y_bond_yield_times_10` DECIMAL(8, 2),
  `nanhua_industrial_index` DECIMAL(10, 2),
  PRIMARY KEY (`observation_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `macro_state_return_score_rules` (
  `market_scope` VARCHAR(32) NOT NULL,
  `factor_dimension` VARCHAR(32) NOT NULL,
  `macro_state` VARCHAR(64) NOT NULL,
  `relative_return_rate` DECIMAL(8, 2) NOT NULL,
  `score` TINYINT NOT NULL,
  PRIMARY KEY (`market_scope`, `factor_dimension`, `macro_state`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `macro_state_monitor_monthly_panel` (
  `factor_dimension` VARCHAR(32) NOT NULL,
  `indicator_name` VARCHAR(64) NOT NULL,
  `observation_month` DATE NOT NULL,
  `indicator_value` DECIMAL(10, 2),
  `current_state` VARCHAR(64),
  `score` TINYINT,
  `trend` TINYINT,
  `previous_ma3` DECIMAL(10, 2),
  `latest_ma3` DECIMAL(10, 2),
  PRIMARY KEY (`indicator_name`, `observation_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `macro_factor_score_monthly` (
  `observation_month` DATE NOT NULL,
  `economic_cycle_score` TINYINT NOT NULL,
  `monetary_credit_score` TINYINT NOT NULL,
  `inflation_score` TINYINT NOT NULL,
  `overseas_liquidity_score` TINYINT NOT NULL,
  `total_score` TINYINT NOT NULL,
  `valuation_bias` VARCHAR(32),
  PRIMARY KEY (`observation_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `macro_factor_percentile_snapshot` (
  `factor_dimension` VARCHAR(32) NOT NULL,
  `indicator_name` VARCHAR(64) NOT NULL,
  `percentile_1y` DECIMAL(6, 2) NOT NULL,
  `percentile_3y` DECIMAL(6, 2) NOT NULL,
  `percentile_10y` DECIMAL(6, 2) NOT NULL,
  PRIMARY KEY (`factor_dimension`, `indicator_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
