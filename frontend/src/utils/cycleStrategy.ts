import type { ChartPreview, ComponentDslConfig, MetricSetting } from '../types/dashboard';
import type { StrategyChartSnapshot } from './strategies';

const CYCLE_MODEL_CODE = 'macro_pmi_bond_industrial_cycle_monthly';
const CYCLE_RULE_MODEL_CODE = 'macro_state_trend_matrix';
const CYCLE_CHART_TITLE = '三因素风格周期走势图';
const CYCLE_RULE_TITLE = '三因素风格周期定位';

type TrendFlag = -1 | 1;

interface CycleObservation {
  label: string;
  m1: number;
  bond: number;
  industrial: number;
}

interface CycleRule {
  stateCode: string;
  m1Trend: TrendFlag;
  industrialTrend: TrendFlag;
  bondTrend: TrendFlag;
}

interface CycleStatusResult {
  modeLabel: string;
  targetLabel: string;
  stateCode: string;
  observation: CycleObservation;
  rule: CycleRule;
  description: string;
}

function cloneMetric(metric: MetricSetting): MetricSetting {
  return { ...metric, layerIds: [...metric.layerIds] };
}

function normalizeCycleMetrics(metrics: MetricSetting[]) {
  const base = metrics.map(cloneMetric);
  const layerIds = base[0]?.layerIds?.length ? [...base[0].layerIds] : ['chart-layer-1'];
  const m1Metric: MetricSetting = {
    fieldCode: 'm1_yoy',
    displayName: 'M1同比',
    aggType: 'avg',
    chartType: 'line',
    yAxis: 'left',
    color: '#ee6666',
    negativeColor: '#dc2626',
    smooth: false,
    showSymbol: false,
    layerIds
  };
  const bondMetric: MetricSetting = {
    fieldCode: 'china_10y_bond_yield_times_10',
    displayName: '10Y国债到期收益率*10',
    aggType: 'avg',
    chartType: 'line',
    yAxis: 'left',
    color: '#73c0de',
    negativeColor: '#73c0de',
    smooth: false,
    showSymbol: false,
    layerIds
  };
  const industrialMetric: MetricSetting = {
    fieldCode: 'nanhua_industrial_index',
    displayName: '南华工业品指数',
    aggType: 'avg',
    chartType: 'line',
    yAxis: 'right',
    color: '#f59e0b',
    negativeColor: '#f59e0b',
    smooth: false,
    showSymbol: false,
    layerIds
  };
  return [m1Metric, bondMetric, industrialMetric];
}

function buildCycleTableDsl(dslConfig: ComponentDslConfig) {
  const dimensionField = dslConfig.queryDsl.dimensionFields[0] ?? 'observation_month';
  const metrics = dslConfig.queryDsl.metrics;
  const metricColumns = metrics.map((metric, index) => ({
    id: `field-${metric.fieldCode}`,
    fieldCode: metric.fieldCode,
    title: metric.displayName || metric.fieldCode,
    role: 'metric' as const,
    width: index === 2 ? 160 : 140,
    align: 'right' as const,
    formatter: 'number' as const,
    visible: true,
    groupTitle: '指标'
  }));

  return {
    template: {
      rowFields: [],
      columnFields: [],
      valueFields: [],
      threshold: 0,
      gtColor: '#fecaca',
      lteColor: '#dcfce7'
    },
    rowHeaders: [],
    columnHeaders: [],
    columns: [
      {
        id: `field-${dimensionField}`,
        fieldCode: dimensionField,
        title: '月份',
        role: 'dimension' as const,
        width: 160,
        align: 'left' as const,
        formatter: 'text' as const,
        visible: true,
        groupTitle: '维度'
      },
      ...metricColumns
    ],
    headerGroups: [],
    headerCells: [],
    bodyCells: [],
    merges: [],
    styles: {},
    conditionalFormats: [],
    widgets: [],
    regionStyles: [],
    pagination: {
      enabled: true,
      pageSize: 12
    },
    summary: {
      enabled: false,
      label: '合计',
      metricFieldCodes: metrics.map(metric => metric.fieldCode)
    },
    rowNumber: false,
    striped: false,
    bordered: true,
    size: 'small' as const,
    rowSelection: false,
    emptyText: '当前条件下暂无数据'
  };
}

export function isCycleTrendChart(snapshot: Pick<StrategyChartSnapshot, 'modelCode' | 'componentTitle'>) {
  return snapshot.modelCode === CYCLE_MODEL_CODE
    && snapshot.componentTitle.includes(CYCLE_CHART_TITLE);
}

export function isCycleRuleChart(snapshot: Pick<StrategyChartSnapshot, 'modelCode' | 'componentTitle'>) {
  return snapshot.modelCode === CYCLE_RULE_MODEL_CODE
    && snapshot.componentTitle.includes(CYCLE_RULE_TITLE);
}

export function repairCycleStrategyDsl(dslConfig: ComponentDslConfig) {
  if (dslConfig.queryDsl.modelCode !== CYCLE_MODEL_CODE) {
    return dslConfig;
  }
  const title = dslConfig.visualDsl.title || '';
  if (!title.includes(CYCLE_CHART_TITLE)) {
    return dslConfig;
  }

  const nextMetrics = normalizeCycleMetrics(dslConfig.queryDsl.metrics ?? []);
  return {
    ...dslConfig,
    queryDsl: {
      ...dslConfig.queryDsl,
      metrics: nextMetrics
    },
    visualDsl: {
      ...dslConfig.visualDsl,
      leftAxisName: '%',
      rightAxisName: '点位'
    },
    tableDsl: buildCycleTableDsl({
      ...dslConfig,
      queryDsl: {
        ...dslConfig.queryDsl,
        metrics: nextMetrics
      }
    })
  };
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toTrendFlag(current: number, previous: number): TrendFlag {
  return current >= previous ? 1 : -1;
}

function normalizeTimeLabel(label: string) {
  return label.replace(/T.*/, '');
}

function parseCycleObservations(preview?: ChartPreview) {
  if (!preview) {
    return [] as CycleObservation[];
  }
  return (preview.rows ?? [])
    .map(row => {
      const label = String(row.observation_month ?? '').trim();
      const m1 = toFiniteNumber(row.m1_yoy);
      const bond = toFiniteNumber(row.china_10y_bond_yield_times_10);
      const industrial = toFiniteNumber(row.nanhua_industrial_index);
      if (!label || m1 == null || bond == null || industrial == null) {
        return undefined;
      }
      return {
        label: normalizeTimeLabel(label),
        m1,
        bond,
        industrial
      };
    })
    .filter((item): item is CycleObservation => Boolean(item));
}

function parseCycleRules(preview?: ChartPreview) {
  if (!preview) {
    return [] as CycleRule[];
  }
  return (preview.rows ?? [])
    .map(row => {
      const stateCode = String(row.state_code ?? '').trim();
      const m1Trend = toFiniteNumber(row.m1_yoy_trend);
      const industrialTrend = toFiniteNumber(row.nanhua_industrial_index_trend);
      const bondTrend = toFiniteNumber(row.china_10y_bond_yield_trend);
      if (!stateCode || (m1Trend !== 1 && m1Trend !== -1) || (industrialTrend !== 1 && industrialTrend !== -1) || (bondTrend !== 1 && bondTrend !== -1)) {
        return undefined;
      }
      return {
        stateCode,
        m1Trend,
        industrialTrend,
        bondTrend
      } satisfies CycleRule;
    })
    .filter((item): item is CycleRule => Boolean(item));
}

function formatValue(value: number, digits = 2) {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(value);
}

function inferFrequency(prompt: string) {
  return '按月';
}

function inferLookback(prompt: string) {
  const recentMonths = prompt.match(/最近(\d+)个?月/);
  if (recentMonths) {
    return Math.max(1, Number(recentMonths[1]));
  }
  const recentDays = prompt.match(/最近(\d+)天/);
  if (recentDays) {
    return Math.max(1, Math.ceil(Number(recentDays[1]) / 30));
  }
  return 3;
}

function inferTargetLabel(prompt: string, observations: CycleObservation[]) {
  const normalized = prompt.replace(/\s+/g, '');
  const exactDate = normalized.match(/(20\d{2}[-/.年]\d{1,2}(?:[-/.月]\d{1,2})?)/);
  if (exactDate) {
    const candidate = exactDate[1]
      .replace(/[年/.]/g, '-')
      .replace(/月/g, '')
      .replace(/日/g, '')
      .replace(/--+/g, '-');
    const matched = observations.find(item => item.label.startsWith(candidate));
    if (matched) {
      return matched.label;
    }
  }
  if (normalized.includes('上个月') || normalized.includes('前一个月')) {
    return observations.length >= 2 ? observations[observations.length - 2]?.label : observations[0]?.label;
  }
  if (normalized.includes('本月') || normalized.includes('当前') || normalized.includes('目前') || normalized.includes('最新')) {
    return observations.length > 0 ? observations[observations.length - 1]?.label : undefined;
  }
  return observations.length > 0 ? observations[observations.length - 1]?.label : undefined;
}

function findObservationByLabel(observations: CycleObservation[], label?: string) {
  if (!label) {
    return undefined;
  }
  return observations.find(item => item.label === label);
}

function buildCycleDescription(observation: CycleObservation, previous: CycleObservation) {
  const m1Trend = toTrendFlag(observation.m1, previous.m1);
  const industrialTrend = toTrendFlag(observation.industrial, previous.industrial);
  const bondTrend = toTrendFlag(observation.bond, previous.bond);
  const trends = [
    `M1同比${m1Trend > 0 ? '回升' : '回落'}(${formatValue(previous.m1)} -> ${formatValue(observation.m1)})`,
    `南华工业品指数${industrialTrend > 0 ? '回升' : '回落'}(${formatValue(previous.industrial)} -> ${formatValue(observation.industrial, 0)})`,
    `10Y国债收益率${bondTrend > 0 ? '回升' : '回落'}(${formatValue(previous.bond)} -> ${formatValue(observation.bond)})`
  ];
  return {
    m1Trend,
    industrialTrend,
    bondTrend,
    text: trends.join('，')
  };
}

function findCycleState(rulePreview?: ChartPreview, trendPreview?: ChartPreview, prompt = '') {
  const rules = parseCycleRules(rulePreview);
  const observations = parseCycleObservations(trendPreview);
  if (rules.length === 0 || observations.length < 2) {
    return undefined;
  }

  const targetLabel = inferTargetLabel(prompt, observations);
  const current = findObservationByLabel(observations, targetLabel);
  if (!current) {
    return undefined;
  }
  const currentIndex = observations.findIndex(item => item.label === current.label);
  const previous = observations[Math.max(0, currentIndex - 1)];
  if (!previous || previous.label === current.label) {
    return undefined;
  }

  const trend = buildCycleDescription(current, previous);
  const matchedRule = rules.find(rule => (
    rule.m1Trend === trend.m1Trend
    && rule.industrialTrend === trend.industrialTrend
    && rule.bondTrend === trend.bondTrend
  ));
  if (!matchedRule) {
    return undefined;
  }

  return {
    modeLabel: inferFrequency(prompt),
    targetLabel: current.label,
    stateCode: matchedRule.stateCode,
    observation: current,
    rule: matchedRule,
    description: trend.text
  } satisfies CycleStatusResult;
}

function buildCycleTrendNarrative(trendPreview?: ChartPreview, prompt = '') {
  const observations = parseCycleObservations(trendPreview);
  if (observations.length < 2) {
    return undefined;
  }
  const lookback = inferLookback(prompt);
  const selected = observations.slice(-Math.max(lookback + 1, 2));
  const segments = selected.slice(1).map((item, index) => {
    const previous = selected[index];
    return `${item.label}：M1 ${formatValue(previous.m1)} -> ${formatValue(item.m1)}，10Y国债 ${formatValue(previous.bond)} -> ${formatValue(item.bond)}，南华工业品 ${formatValue(previous.industrial, 0)} -> ${formatValue(item.industrial, 0)}`;
  });
  return `${inferFrequency(prompt)}观察近${lookback}期：\n${segments.join('\n')}`;
}

export function buildCycleStrategyAiReply(
  strategyName: string,
  prompt: string,
  charts: StrategyChartSnapshot[],
  previewMap: Record<string, ChartPreview>
) {
  const ruleChart = charts.find(isCycleRuleChart);
  const trendChart = charts.find(isCycleTrendChart);
  if (!ruleChart || !trendChart) {
    return undefined;
  }

  const normalizedPrompt = prompt.replace(/\s+/g, '');
  const status = findCycleState(previewMap[ruleChart.chartId], previewMap[trendChart.chartId], prompt);
  const trendNarrative = buildCycleTrendNarrative(previewMap[trendChart.chartId], prompt);

  if (status && /状态|所属|周期|当前|目前|最新|本月|上个月|什么时候|查询/.test(normalizedPrompt)) {
    return [
      `结合“${ruleChart.componentTitle}”里的状态规则和“${trendChart.componentTitle}”的真实数据，${status.modeLabel}口径下 ${status.targetLabel} 当前落在 ${status.stateCode}。`,
      `${status.description}。`,
      `对应规则是：M1同比趋势=${status.rule.m1Trend}，南华工业品趋势=${status.rule.industrialTrend}，10Y国债收益率趋势=${status.rule.bondTrend}。`,
      '你也可以继续直接问我：查某个月属于什么状态、近12个月怎么演变，或者把每个状态怎么解读展开说明。'
    ].join('\n');
  }

  if (trendNarrative && /按月|最近|走势|变化|解读|近\d+个?月/.test(normalizedPrompt)) {
    return [
      `我先按三周期策略给你做一段按月视角的跟踪：`,
      trendNarrative,
      status ? `如果按规则映射，最新一期 ${status.targetLabel} 对应 ${status.stateCode}。` : '如果你要，我可以继续把这些变化映射成具体状态。'
    ].join('\n');
  }

  if (status) {
    return [
      `当前“${strategyName}”可以直接按三周期规则给出状态判断。`,
      `最新一期 ${status.targetLabel} 对应 ${status.stateCode}，判断依据是：${status.description}。`,
      '继续追问“按月看最近6个月”“2025-10 属于什么状态”“把状态1到状态7分别解释一下”都可以直接聊。'
    ].join('\n');
  }

  return undefined;
}
