# 投研策略化平台首批指标可视化前端开发方案 1.0

本文档用于描述投研策略化平台首批指标可视化前端的运行态与设计态分工、看板配置模型、组件配置模型、数据交互形式，以及折线图和数据表的完整配置属性与流转流程。

当前重点覆盖：

- 看板
- 折线图组件
- 数据表组件
- 组件保存
- 看板保存与发布

本文档严格基于现有配置属性整理，不展开额外能力设计。

---

## 1. 建设目标与范围

本期前端建设目标是提供一套可配置、可保存、可运行的指标可视化能力，支持：

- 看板布局承载多个组件
- 图表组件配置与运行
- 数据表组件配置与运行
- 设计态生成 DSL
- 运行态基于 DSL 请求后端数据并渲染
- 组件配置保存
- 看板整体保存与发布

当前图表类型范围：

- 折线图
- 分位图（后续扩展）
- 散点图（后续扩展）
- 其它图类型（后续扩展）

本文仅按现有属性详细展开折线图。

---

## 2. 运行态与设计态分工

### 2.1 运行态

运行态面向看板使用者，主要职责：

- 加载已发布看板
- 拉取组件 DSL
- 请求运行数据
- 渲染图表与表格
- 响应图表缩放、悬浮、分页等交互

运行态不负责修改结构性配置。

### 2.2 设计态

设计态面向配置人员，主要职责：

- 新建 / 编辑看板
- 新增 / 编辑 / 删除组件
- 配置图表或数据表属性
- 生成组件 DSL
- 保存组件配置
- 保存看板配置
- 提交看板发布

设计态是 DSL 的来源。

---

## 3. 看板配置（最上层）

看板是最上层承载实体，用于管理布局与组件列表。

### 3.1 看板配置骨架

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

### 3.2 看板层职责

看板层只负责：

- 看板编码
- 看板名称
- 布局类型
- 组件列表
- 组件位置与尺寸
- 组件标题
- 组件所引用 DSL

看板层不直接参与图表统计与表格列生成。

---

## 4. 组件类型与结构

当前组件分为两类：

### 4.1 图表组件

图表组件采用三段式结构：

- `queryDsl` + `displayDsl` + `statDsl`

### 4.2 数据表组件

数据表组件采用两段式结构：

- `queryDsl` + `tableDsl`

---

## 5. 折线图组件配置（严格按现有属性）

本文只详细展开折线图。

### 5.1 图表配置总结构

```json
{
  "queryDsl": {},
  "displayDsl": {},
  "statDsl": {}
}
```

### 5.2 `queryDsl`：数据模型与查询参数

`queryDsl` 用于描述图表向后端发送的查询请求。

#### 已有属性

- `datasetCode`
- `mainDimension`
- `secondDimension`
- `metrics`
- `filters`
- `sort`

#### 配置骨架

```json
{
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
}
```

#### 属性说明

| 属性 | 说明 |
| --- | --- |
| `datasetCode` | 数据集编码 |
| `mainDimension` | 主维度，折线图中通常是时间轴 |
| `secondDimension` | 第二维度，用于区分不同序列 |
| `metrics` | 指标列表，支持多个指标同时展示 |
| `filters` | 过滤条件 |
| `sort` | 排序条件 |

### 5.3 `displayDsl`：图表展示配置

`displayDsl` 用于描述图表如何展示。

#### 已有属性

- `title`
- `stackBySecondDimension`
- `xAxis`
- `yAxis`
- `baseSeriesConfigs`

#### 配置骨架

```json
{
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
}
```

#### 属性说明

##### 顶层属性

| 属性 | 说明 |
| --- | --- |
| `title` | 图表标题 |
| `stackBySecondDimension` | 第二维度是否堆叠 |
| `xAxis` | 横轴配置 |
| `yAxis` | 纵轴配置，支持左右轴 |
| `baseSeriesConfigs` | 基础序列配置列表 |

##### `xAxis`

| 属性 | 说明 |
| --- | --- |
| `type` | 横轴类型，折线图当前为 `time` |
| `name` | 横轴名称 |

##### `yAxis`

| 属性 | 说明 |
| --- | --- |
| `axisIndex` | 轴索引 |
| `name` | 轴名称 |
| `position` | 轴位置，`left` / `right` |

##### `baseSeriesConfigs`

每一个基础序列描述一个“维度值 + 指标”的展示方式。

###### 已有属性

- `seriesKey`
- `seriesName`
- `dimensionValue`
- `metricField`
- `renderType`
- `yAxisIndex`
- `style`

###### `style` 已有属性

- `showSymbol`
- `smooth`
- `color`
- `lineWidth`
- `areaOpacity`

###### `baseSeriesConfigs` 属性说明

| 属性 | 说明 |
| --- | --- |
| `seriesKey` | 序列唯一标识 |
| `seriesName` | 图例名称 |
| `dimensionValue` | 第二维度取值 |
| `metricField` | 指标字段 |
| `renderType` | 展示方式，当前可为 `line` / `area` / `bar` / `scatter` |
| `yAxisIndex` | 挂接左轴或右轴 |
| `style` | 样式配置 |

###### `style` 属性说明

| 属性 | 说明 |
| --- | --- |
| `showSymbol` | 是否显示点位 |
| `smooth` | 是否平滑 |
| `color` | 颜色 |
| `lineWidth` | 线宽 |
| `areaOpacity` | 面积图透明度，仅面积图有效 |

### 5.4 `statDsl`：统计指标配置

`statDsl` 用于描述统计指标。

#### 已有属性

- `items`

每个 `items` 中已包含以下属性：

- `statKey`
- `targetSeriesKey`
- `scope`
- `statType`
- `compute`
- `levels`
- `window`
- `renderMode`
- `renderType`
- `yAxisIndex`
- `style`

#### 配置骨架

```json
{
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
```

### 5.5 统计属性说明

#### 通用属性

| 属性 | 说明 |
| --- | --- |
| `statKey` | 统计项唯一标识 |
| `targetSeriesKey` | 目标基础序列 |
| `scope` | 统计范围，当前支持 `visible` / `rolling` |
| `statType` | 统计类型 |
| `compute` | 计算位置，当前支持 `frontend` / `backend` |
| `renderMode` | 展示归属方式，支持 `new_layer` / `overlay_base` |
| `renderType` | 展示形式，支持 `line` / `band` |
| `yAxisIndex` | 统计结果挂接的轴 |
| `style` | 样式配置 |

#### `scope`

| 取值 | 说明 |
| --- | --- |
| `visible` | 可视窗口统计 |
| `rolling` | 滚动窗口统计 |

#### `statType`

| 取值 | 说明 |
| --- | --- |
| `mean` | 均值 |
| `std_band` | 方差区间 |
| `percentile_rank` | 分位排名曲线 |

#### `compute`

| 取值 | 说明 |
| --- | --- |
| `frontend` | 前端计算 |
| `backend` | 后端计算 |

#### `levels`

用于方差区间：

| 值 | 说明 |
| --- | --- |
| `1` | 1 倍标准差 |
| `2` | 2 倍标准差 |

#### `window`

用于滚动窗口：

| 属性 | 说明 |
| --- | --- |
| `size` | N 年中的 N |
| `unit` | 当前固定为 `year` |

#### `renderMode`

| 取值 | 说明 |
| --- | --- |
| `new_layer` | 新增图层展示 |
| `overlay_base` | 在原有序列语义上叠加展示 |

#### `style`（统计项）

已使用属性：

- `color`
- `lineWidth`
- `lineStyle`
- `showSymbol`
- `level1Opacity`
- `level2Opacity`

| 属性 | 说明 |
| --- | --- |
| `color` | 颜色 |
| `lineWidth` | 线宽 |
| `lineStyle` | 线型 |
| `showSymbol` | 是否显示点位 |
| `level1Opacity` | 1 倍区间透明度 |
| `level2Opacity` | 2 倍区间透明度 |

---

## 6. 折线图：前后端交互形式

### 6.1 向后端发送形式

前端向后端发送的是图表 DSL，其中真正参与查询的核心是 `queryDsl`，统计中 `compute=backend` 的部分由后端参考。

发送内容整体形式：

- `queryDsl` + `displayDsl` + `statDsl`

其中：

- `queryDsl`：后端查询数据
- `displayDsl`：前端保留展示配置
- `statDsl`：后端处理 `rolling`，前端处理 `visible`

### 6.2 后端返回形式

后端返回的是标准化图表数据结果，而不是 ECharts option。

返回结构：

```json
{
  "baseSeries": [],
  "backendStatSeries": []
}
```

| 字段 | 说明 |
| --- | --- |
| `baseSeries` | 基础序列数据 |
| `backendStatSeries` | 后端已计算好的滚动统计序列 |

---

## 7. 折线图：前端转换流程

前端将 DSL 与后端返回数据转换为 option 的流程如下：

图表 DSL + 后端返回数据  
→ 基础序列处理  
→ 后端统计序列处理  
→ 可视窗口统计计算  
→ 合并生成 option

### 7.1 基础序列处理

来源：

- `displayDsl.baseSeriesConfigs`
- `baseSeries`

结果：

- 基础图层 `series`

### 7.2 后端统计处理

来源：

- `statDsl.items` 中 `compute=backend`
- `backendStatSeries`

结果：

- `rolling` 均值图层
- `rolling` 标准差区间图层

### 7.3 可视窗口统计处理

来源：

- `statDsl.items` 中 `compute=frontend`
- 当前 `dataZoom` 可视范围
- `baseSeries`

结果：

- 可视窗口均值图层
- 可视窗口方差区间图层
- 可视窗口分位排名曲线图层

### 7.4 最终输出

最终生成：

- ECharts `option`

---

## 8. 数据表配置

数据表组件与图表组件并列。

### 8.1 数据表 DSL 总结构

```json
{
  "queryDsl": {},
  "tableDsl": {}
}
```

### 8.2 数据表 `queryDsl`

数据表沿用与图表一致的数据查询结构，属性包括：

- `datasetCode`
- `mainDimension`
- `secondDimension`
- `metrics`
- `filters`
- `sort`
- `pagination`

配置骨架：

```json
{
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
}
```

### 8.3 数据表 `tableDsl`

`tableDsl` 用于描述页面表格展示结构。

当前已有属性：

- `columns`
- `style`
- `pagination`

配置骨架：

```json
{
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
```

### 8.4 `tableDsl.columns` 属性说明

| 属性 | 说明 |
| --- | --- |
| `field` | 字段名 |
| `title` | 列标题 |
| `width` | 列宽 |
| `sortable` | 是否支持排序 |
| `format` | 格式化方式 |

### 8.5 `tableDsl.style` 属性说明

| 属性 | 说明 |
| --- | --- |
| `stripe` | 是否条纹 |
| `border` | 是否边框 |
| `size` | 表格尺寸 |

### 8.6 `tableDsl.pagination`

| 属性 | 说明 |
| --- | --- |
| `enabled` | 是否开启分页 |

---

## 9. 数据表：前后端交互形式

### 9.1 向后端发送形式

前端向后端发送：

- `queryDsl` + `tableDsl`

其中：

- `queryDsl` 用于后端查询
- `tableDsl` 主要用于前端展示

### 9.2 后端返回形式

后端返回表格标准结果，而不是页面表格组件。

前端最终需要将结果转换为：

- `columns` + `dataSource` + `pagination`

---

## 10. 数据表：前端转换流程

- `tableDsl.columns` → 生成 `columns`
- 后端返回数据 → 转换为 `dataSource + pagination`

最终输出：

- `columns + dataSource + pagination`

---

## 11. 组件保存

组件保存分为图表组件保存和数据表组件保存。

### 11.1 图表组件保存

设计态操作流程：

图表配置  
→ 生成 `queryDsl + displayDsl + statDsl`  
→ 保存组件

保存内容包括：

- `widgetCode`
- `widgetType=chart`
- `title`
- `position`
- `dsl`

### 11.2 数据表组件保存

设计态操作流程：

数据表配置  
→ 生成 `queryDsl + tableDsl`  
→ 保存组件

保存内容包括：

- `widgetCode`
- `widgetType=table`
- `title`
- `position`
- `dsl`

---

## 12. 看板保存与发布

### 12.1 看板保存

流程：

看板布局 + 组件列表 + 每个组件 DSL  
→ 保存看板

保存内容包括：

- `dashboardCode`
- `dashboardName`
- `layout`
- `widgets`

### 12.2 看板发布

流程：

已保存看板  
→ 提交发布  
→ 标记可供运行态加载

发布后的运行态读取的是：

- 看板结构
- 组件 DSL
- 组件位置与标题

---

## 13. 页面流程（运行态与设计态）

### 13.1 设计态页面流程

配置看板  
→ 配置组件  
→ 生成组件 DSL  
→ 保存组件  
→ 保存看板  
→ 发布看板

### 13.2 运行态页面流程

加载看板  
→ 获取组件 DSL  
→ 请求组件数据  
→ 前端转换  
→ 渲染图表 / 表格

---

## 14. 当前方案核心边界

### 14.1 前端负责

- 设计态配置收集
- DSL 生成
- DSL 保存
- 运行态根据 DSL 发请求
- 图表 option 生成
- 数据表 `columns + dataSource + pagination` 生成
- 可视窗口统计计算

### 14.2 后端负责

- 根据 `queryDsl` 查询数据
- 根据 `statDsl` 中 `compute=backend` 处理 `rolling` 统计
- 返回标准化组件数据结果

---

## 15. 当前方案的最终模型

```text
Dashboard
  ├─ Chart Widget
  │    ├─ queryDsl
  │    ├─ displayDsl
  │    └─ statDsl
  └─ Table Widget
       ├─ queryDsl
       └─ tableDsl
```

