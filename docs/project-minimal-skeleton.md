# 项目最简骨架与 DSL 示例

本文档用于描述 BI 图表平台（前端）的最简工程骨架、目录与文件职责，以及三类核心配置（看板、图表、数据表）的最简 DSL/配置示例。

---

## 1. 项目最简骨架（建议）

```text
src/
  api/
    dashboardApi.ts
    widgetApi.ts

  dsl/
    buildDashboardDsl.ts
    buildChartDsl.ts
    buildTableDsl.ts

  chart/
    buildChartOption.ts
    buildBaseSeries.ts
    buildBackendStatSeries.ts
    buildVisibleStatSeries.ts
    stats.ts

  table/
    buildTableColumns.ts
    buildTableViewModel.ts

  types/
    dashboard.ts
    chart.ts
    table.ts
    widget.ts

  pages/
    DashboardPage.tsx
    WidgetChartPage.tsx
    WidgetTablePage.tsx

  components/
    dashboard/
      DashboardCanvas.tsx
      WidgetContainer.tsx
    chart/
      ChartWidget.tsx
    table/
      TableWidget.tsx
```

---

## 2. 目录与文件职责

### 2.1 `api/`：后端交互

负责与后端进行数据与配置的交互。

| 文件 | 主要职责 |
| --- | --- |
| `dashboardApi.ts` | 获取整个看板配置；保存整个看板配置 |
| `widgetApi.ts` | 查询单个组件数据；获取单个组件 DSL |

### 2.2 `dsl/`：设计态配置 → DSL 组装

负责将设计态的配置数据组装为可持久化/可运行的 DSL。

| 文件 | 主要职责 |
| --- | --- |
| `buildDashboardDsl.ts` | 把整个看板配置组装成看板 DSL |
| `buildChartDsl.ts` | 把图表配置组装成图表 DSL |
| `buildTableDsl.ts` | 把数据表配置组装成表格 DSL |

### 2.3 `chart/`：图表渲染前的数据加工与 option 构建

负责将“图表 DSL + 后端数据”转换为 ECharts 可渲染的 `option`，并组织基础序列、统计序列与图层逻辑。

| 文件 | 主要职责 |
| --- | --- |
| `buildChartOption.ts` | 把图表 DSL + 后端数据 转成 ECharts option |
| `buildBaseSeries.ts` | 基础指标序列转图层（主序列） |
| `buildBackendStatSeries.ts` | 后端滚动统计结果转图层（rolling 范围，backend 计算） |
| `buildVisibleStatSeries.ts` | 前端可视窗口统计结果转图层（visible 范围，frontend 计算） |
| `stats.ts` | 均值、标准差、分位排名等计算逻辑（用于 frontend 计算部分） |

### 2.4 `table/`：数据表渲染前的数据加工

负责将表格 DSL 与后端数据转换为表格组件所需的列定义与视图模型。

| 文件 | 主要职责 |
| --- | --- |
| `buildTableColumns.ts` | 表格列配置生成 |
| `buildTableViewModel.ts` | 后端返回数据转成表格展示结构 |

### 2.5 `types/`：类型定义

用于定义看板、组件、图表 DSL、表格 DSL 等结构。

| 文件 | 主要职责 |
| --- | --- |
| `dashboard.ts` | 看板类型定义 |
| `chart.ts` | 图表 DSL 类型定义 |
| `table.ts` | 数据表 DSL 类型定义 |
| `widget.ts` | 组件公共类型定义 |

### 2.6 `pages/`：页面入口

用于组织路由入口与页面级状态。

| 文件 | 主要职责 |
| --- | --- |
| `DashboardPage.tsx` | 整个看板运行页 |
| `WidgetChartPage.tsx` | 单个图表组件页 |
| `WidgetTablePage.tsx` | 单个数据表组件页 |

### 2.7 `components/`：页面组件

用于承载看板布局、组件容器、图表组件、表格组件。

| 文件 | 主要职责 |
| --- | --- |
| `dashboard/DashboardCanvas.tsx` | 看板布局容器 |
| `dashboard/WidgetContainer.tsx` | 统一组件容器，负责决定渲染图表还是表格 |
| `chart/ChartWidget.tsx` | 图表组件 |
| `table/TableWidget.tsx` | 数据表组件 |

---

## 3. 看板配置骨架（最上层）

看板是最上层实体。看板下包含多个组件（widget），组件可以是图表或数据表。每个组件包含位置、标题与 DSL。

```json
{
  "dashboardCode": "dashboard_001",
  "dashboardName": "估值分析看板",
  "layout": {
    "type": "grid"
  },
  "widgets": [
    {
      "widgetCode": "chart_001",
      "widgetType": "chart",
      "title": "估值走势分析",
      "position": {
        "x": 0,
        "y": 0,
        "w": 12,
        "h": 8
      },
      "dsl": {
        "queryDsl": {},
        "displayDsl": {},
        "statDsl": {}
      }
    },
    {
      "widgetCode": "table_001",
      "widgetType": "table",
      "title": "估值明细表",
      "position": {
        "x": 0,
        "y": 8,
        "w": 12,
        "h": 6
      },
      "dsl": {
        "queryDsl": {},
        "tableDsl": {}
      }
    }
  ]
}
```

---

## 4. 图表配置骨架（时序分析图最简必要配置）

该示例用于说明“时序分析类图表”的最简 DSL 结构，分为三个部分：

- `queryDsl`：请求后端数据所需参数（数据模型、维度、指标、过滤、排序等）
- `displayDsl`：图表展示配置（坐标轴、系列配置、样式等）
- `statDsl`：统计指标配置（可视窗口统计、滚动 N 年统计；前端计算与后端计算并存）

```json
{
  "queryDsl": {
    "datasetCode": "valuation_timeseries",
    "mainDimension": {
      "field": "trade_date",
      "alias": "日期"
    },
    "secondDimension": {
      "field": "index_name",
      "alias": "指数"
    },
    "metrics": [
      {
        "field": "pe_ttm",
        "alias": "PE"
      },
      {
        "field": "pb_lf",
        "alias": "PB"
      }
    ],
    "filters": [],
    "sort": [
      {
        "field": "trade_date",
        "order": "asc"
      }
    ]
  },
  "displayDsl": {
    "title": "估值分析图",
    "stackBySecondDimension": true,
    "xAxis": {
      "type": "time",
      "name": "日期"
    },
    "yAxis": [
      {
        "axisIndex": 0,
        "name": "估值",
        "position": "left"
      },
      {
        "axisIndex": 1,
        "name": "统计/分位数",
        "position": "right"
      }
    ],
    "baseSeriesConfigs": [
      {
        "seriesKey": "沪深300|pe_ttm",
        "seriesName": "沪深300 PE",
        "dimensionValue": "沪深300",
        "metricField": "pe_ttm",
        "renderType": "line",
        "yAxisIndex": 0,
        "style": {
          "showSymbol": false,
          "smooth": true,
          "color": "#5470C6",
          "lineWidth": 2
        }
      },
      {
        "seriesKey": "中证500|pe_ttm",
        "seriesName": "中证500 PE",
        "dimensionValue": "中证500",
        "metricField": "pe_ttm",
        "renderType": "area",
        "yAxisIndex": 0,
        "style": {
          "showSymbol": false,
          "smooth": true,
          "color": "#91CC75",
          "lineWidth": 2,
          "areaOpacity": 0.18
        }
      },
      {
        "seriesKey": "沪深300|pb_lf",
        "seriesName": "沪深300 PB",
        "dimensionValue": "沪深300",
        "metricField": "pb_lf",
        "renderType": "bar",
        "yAxisIndex": 1,
        "style": {
          "color": "#FAC858"
        }
      }
    ]
  },
  "statDsl": {
    "items": [
      {
        "statKey": "visible_mean_hs300_pe",
        "targetSeriesKey": "沪深300|pe_ttm",
        "scope": "visible",
        "statType": "mean",
        "compute": "frontend",
        "renderMode": "new_layer",
        "renderType": "line",
        "yAxisIndex": 0,
        "style": {
          "color": "#EE6666",
          "lineWidth": 1,
          "lineStyle": "dashed",
          "showSymbol": false
        }
      },
      {
        "statKey": "visible_std_hs300_pe",
        "targetSeriesKey": "沪深300|pe_ttm",
        "scope": "visible",
        "statType": "std_band",
        "compute": "frontend",
        "levels": [1, 2],
        "renderMode": "new_layer",
        "renderType": "band",
        "yAxisIndex": 0,
        "style": {
          "color": "#73C0DE",
          "level1Opacity": 0.18,
          "level2Opacity": 0.1
        }
      },
      {
        "statKey": "visible_percentile_rank_hs300_pe",
        "targetSeriesKey": "沪深300|pe_ttm",
        "scope": "visible",
        "statType": "percentile_rank",
        "compute": "frontend",
        "renderMode": "overlay_base",
        "renderType": "line",
        "yAxisIndex": 1,
        "style": {
          "color": "#9A60B4",
          "lineWidth": 2,
          "lineStyle": "solid",
          "showSymbol": false
        }
      },
      {
        "statKey": "rolling_mean_hs300_pe",
        "targetSeriesKey": "沪深300|pe_ttm",
        "scope": "rolling",
        "statType": "mean",
        "compute": "backend",
        "window": {
          "size": 3,
          "unit": "year"
        },
        "renderMode": "new_layer",
        "renderType": "line",
        "yAxisIndex": 0,
        "style": {
          "color": "#FF9F7F",
          "lineWidth": 2,
          "lineStyle": "solid",
          "showSymbol": false
        }
      },
      {
        "statKey": "rolling_std_hs300_pe",
        "targetSeriesKey": "沪深300|pe_ttm",
        "scope": "rolling",
        "statType": "std_band",
        "compute": "backend",
        "window": {
          "size": 3,
          "unit": "year"
        },
        "levels": [1, 2],
        "renderMode": "new_layer",
        "renderType": "band",
        "yAxisIndex": 0,
        "style": {
          "color": "#3BA272",
          "level1Opacity": 0.12,
          "level2Opacity": 0.06
        }
      }
    ]
  }
}
```

---

## 5. 数据表配置骨架（与图表并列的最简配置）

表格 DSL 同样包含 `queryDsl`，用于定义查询数据集、维度、指标、过滤、排序和分页；`tableDsl` 用于定义列结构与表格展示样式。

```json
{
  "queryDsl": {
    "datasetCode": "valuation_timeseries",
    "mainDimension": {
      "field": "trade_date",
      "alias": "日期"
    },
    "secondDimension": {
      "field": "index_name",
      "alias": "指数"
    },
    "metrics": [
      {
        "field": "pe_ttm",
        "alias": "PE"
      },
      {
        "field": "pb_lf",
        "alias": "PB"
      }
    ],
    "filters": [],
    "sort": [
      {
        "field": "trade_date",
        "order": "desc"
      }
    ],
    "pagination": {
      "pageNo": 1,
      "pageSize": 20
    }
  },
  "tableDsl": {
    "columns": [
      {
        "field": "trade_date",
        "title": "日期",
        "width": 120,
        "sortable": true
      },
      {
        "field": "index_name",
        "title": "指数",
        "width": 120,
        "sortable": true
      },
      {
        "field": "pe_ttm",
        "title": "PE",
        "width": 100,
        "sortable": true,
        "format": "number"
      },
      {
        "field": "pb_lf",
        "title": "PB",
        "width": 100,
        "sortable": true,
        "format": "number"
      }
    ],
    "style": {
      "stripe": true,
      "border": true,
      "size": "middle"
    },
    "pagination": {
      "enabled": true
    }
  }
}
```

