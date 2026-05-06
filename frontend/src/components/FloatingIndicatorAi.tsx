import { CloseOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../api/client';
import type { ChartPreview } from '../types/dashboard';

type IndicatorAiChartContext = {
  id: string;
  title: string;
  preview?: ChartPreview;
};

type IndicatorAiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };

type DragState =
  | { mode: 'trigger'; pointerId: number; start: Point; origin: Point }
  | { mode: 'panel'; pointerId: number; start: Point; origin: Bounds }
  | { mode: 'resize'; pointerId: number; start: Point; origin: Bounds }
  | null;

const STORAGE_KEY = 'strategy-dashboard-indicator-ai-floating-v5';
const TRIGGER_WIDTH = 86;
const TRIGGER_HEIGHT = 48;
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 680;
const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 340;

const TEXT = {
  title: 'AI 指标助手',
  placeholder: '例如：帮我分析当前页指标的整体状态和重点变化',
  open: 'AI',
  send: '发送',
  demo: '全局分析',
  greeting: '我会结合当前页已有指标，帮你做全局分析、重点变化总结和观察建议。'
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim();
    if (!normalized) {
      return undefined;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function formatSummaryNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2
  }).format(value);
}

function buildRecentSummary(title: string, preview?: ChartPreview) {
  const metrics = preview?.queryDsl.metrics ?? [];
  const dimensions = preview?.queryDsl.dimensionFields ?? [];
  const metric = metrics[0];
  if (!preview || !metric) {
    return `${title} 当前可作为辅助观察项。`;
  }

  const metricFieldCode = metric.fieldCode;
  const dimensionFieldCode = dimensions[0];
  const points = (preview.rows ?? [])
    .map((row, index) => {
      const value = toFiniteNumber(row[metricFieldCode]);
      if (value == null) {
        return undefined;
      }
      const label = String((dimensionFieldCode ? row[dimensionFieldCode] : undefined) ?? `第${index + 1}期`);
      return { label, value };
    })
    .filter((item): item is { label: string; value: number } => Boolean(item));

  if (points.length < 2) {
    return `${title} 当前样本较少，建议继续观察。`;
  }

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const delta = last.value - prev.value;
  const trend = delta > 0 ? '较上一期回升' : delta < 0 ? '较上一期回落' : '与上一期基本持平';
  return `${title}：${last.label} 为 ${formatSummaryNumber(last.value)}，${trend}。`;
}

function buildIndicatorMeaning(title: string) {
  if (title.includes('估值')) {
    return '更适合用来观察当前资产是否处于相对高估或低估区间。';
  }
  if (title.includes('波动') || title.includes('风险')) {
    return '更适合用来观察风险偏好和波动状态是否在抬升。';
  }
  if (title.includes('成交') || title.includes('资金') || title.includes('融资')) {
    return '更适合用来观察市场资金活跃度和资金方向变化。';
  }
  if (title.includes('比价') || title.includes('价差')) {
    return '更适合用来观察相对性价比和资产切换信号。';
  }
  return '更适合用来观察该主题下的阶段性变化。';
}

function buildFallbackReply(pageTitle: string, charts: IndicatorAiChartContext[], prompt: string) {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const summaries = charts.slice(0, 6).map(chart => buildRecentSummary(chart.title, chart.preview));
  const meanings = charts.slice(0, 6).map(chart => `${chart.title}：${buildIndicatorMeaning(chart.title)}`);

  if (normalizedPrompt.includes('全局') || normalizedPrompt.includes('整体') || normalizedPrompt.includes('总结') || normalizedPrompt.includes('分析')) {
    return `我先对“${pageTitle}”做一个全局分析：\n当前共关注 ${charts.length} 个指标，建议先从趋势、估值和风险三个维度理解。\n${summaries.join('\n')}`;
  }

  if (normalizedPrompt.includes('看什么') || normalizedPrompt.includes('作用') || normalizedPrompt.includes('指标')) {
    return `当前页这些指标主要在看下面几类信息：\n${meanings.join('\n')}`;
  }

  return `围绕“${pageTitle}”，我建议先看整体变化，再挑重点指标细看。\n${summaries.join('\n')}`;
}

function normalizeTrigger(point: Point) {
  return {
    x: clamp(point.x, 16, window.innerWidth - TRIGGER_WIDTH - 16),
    y: clamp(point.y, 16, window.innerHeight - TRIGGER_HEIGHT - 16)
  };
}

function normalizePanel(bounds: Bounds) {
  const width = clamp(bounds.width, MIN_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, window.innerWidth - 32));
  const height = clamp(bounds.height, MIN_PANEL_HEIGHT, Math.max(MIN_PANEL_HEIGHT, window.innerHeight - 96));
  const x = clamp(bounds.x, 16, Math.max(16, window.innerWidth - width - 16));
  const y = clamp(bounds.y, 72, Math.max(72, window.innerHeight - height - 16));
  return { x, y, width, height };
}

function readLayout() {
  if (typeof window === 'undefined') {
    return undefined;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as Partial<Bounds>;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeLayout(trigger: Point, panel: Bounds) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    x: trigger.x,
    y: trigger.y,
    width: panel.width,
    height: panel.height
  }));
}

function resolveDefaultLayout() {
  const search = document.querySelector<HTMLElement>('.page-toc-width-search');
  const trigger = search
    ? normalizeTrigger({
        x: search.getBoundingClientRect().left - TRIGGER_WIDTH - 12,
        y: search.getBoundingClientRect().top + ((search.getBoundingClientRect().height - TRIGGER_HEIGHT) / 2)
      })
    : normalizeTrigger({
        x: window.innerWidth - TRIGGER_WIDTH - 320,
        y: 118
      });

  const panel = normalizePanel({
    x: trigger.x,
    y: trigger.y + 58,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT
  });

  return { trigger, panel };
}

export default function FloatingIndicatorAi(props: {
  storageKey: string;
  pageTitle: string;
  charts: IndicatorAiChartContext[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<IndicatorAiMessage[]>([
    { id: 'assistant-initial', role: 'assistant', content: TEXT.greeting }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);
  const [triggerPos, setTriggerPos] = useState<Point>({ x: 16, y: 16 });
  const [panelBounds, setPanelBounds] = useState<Bounds>({ x: 16, y: 72, width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState>(null);
  const suppressClickRef = useRef(false);

  const availableCharts = useMemo(
    () => props.charts.filter(item => item.title.trim()),
    [props.charts]
  );

  useEffect(() => {
    const layout = readLayout();
    if (layout && Number.isFinite(layout.x) && Number.isFinite(layout.y)) {
      const trigger = normalizeTrigger({ x: Number(layout.x), y: Number(layout.y) });
      const panel = normalizePanel({
        x: trigger.x,
        y: trigger.y + 58,
        width: Number.isFinite(layout.width) ? Number(layout.width) : PANEL_WIDTH,
        height: Number.isFinite(layout.height) ? Number(layout.height) : PANEL_HEIGHT
      });
      setTriggerPos(trigger);
      setPanelBounds(panel);
      return;
    }

    const apply = () => {
      const next = resolveDefaultLayout();
      setTriggerPos(next.trigger);
      setPanelBounds(next.panel);
    };

    const frame = window.requestAnimationFrame(() => {
      apply();
      window.setTimeout(apply, 120);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setTriggerPos(current => normalizeTrigger(current));
      setPanelBounds(current => normalizePanel(current));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMessages([{ id: `assistant-initial-${props.storageKey}`, role: 'assistant', content: TEXT.greeting }]);
    setInput('');
    setLoading(false);
    setAutoTriggered(false);
    setOpen(false);
  }, [props.storageKey]);

  useEffect(() => {
    if (!messagesRef.current) {
      return;
    }
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (!open || autoTriggered || availableCharts.length === 0) {
      return;
    }
    setAutoTriggered(true);
    setPanelBounds(current => normalizePanel(current));
    void submitPrompt('请对当前页面现有指标做一次全局分析');
  }, [open, autoTriggered, availableCharts.length]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) {
        return;
      }

      const dx = event.clientX - state.start.x;
      const dy = event.clientY - state.start.y;

      if (state.mode === 'trigger') {
        suppressClickRef.current = suppressClickRef.current || Math.abs(dx) > 4 || Math.abs(dy) > 4;
        setTriggerPos(normalizeTrigger({
          x: state.origin.x + dx,
          y: state.origin.y + dy
        }));
        return;
      }

      if (state.mode === 'panel') {
        setPanelBounds(normalizePanel({
          ...state.origin,
          x: state.origin.x + dx,
          y: state.origin.y + dy
        }));
        return;
      }

      setPanelBounds(normalizePanel({
        ...state.origin,
        width: state.origin.width + dx,
        height: state.origin.height + dy
      }));
    };

    const onPointerEnd = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) {
        return;
      }
      dragStateRef.current = null;
      writeLayout(triggerPos, panelBounds);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [panelBounds, triggerPos]);

  const appendMessage = (message: IndicatorAiMessage) => {
    setMessages(current => [...current, message]);
  };

  const submitPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || availableCharts.length === 0 || loading) {
      return;
    }

    appendMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed
    });
    setInput('');

    const assistantMessageId = `assistant-${Date.now()}`;
    appendMessage({
      id: assistantMessageId,
      role: 'assistant',
      content: ''
    });

    const chartContexts = availableCharts.slice(0, 8).map(chart => ({
      title: chart.title,
      summary: buildRecentSummary(chart.title, chart.preview),
      meaning: buildIndicatorMeaning(chart.title)
    }));

    setLoading(true);
    try {
      await api.strategyAiChatStream({
        strategyName: props.pageTitle,
        prompt: trimmed,
        charts: chartContexts
      }, chunk => {
        setMessages(current => current.map(item => (
          item.id === assistantMessageId
            ? { ...item, content: item.content + chunk }
            : item
        )));
      });
    } catch (error) {
      console.error(error);
      setMessages(current => current.map(item => (
        item.id === assistantMessageId
          ? { ...item, content: buildFallbackReply(props.pageTitle, availableCharts, trimmed) }
          : item
      )));
    } finally {
      setLoading(false);
    }
  };

  const startTriggerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = {
      mode: 'trigger',
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: triggerPos
    };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startPanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.floating-indicator-ai-close')) {
      return;
    }
    dragStateRef.current = {
      mode: 'panel',
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: panelBounds
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = {
      mode: 'resize',
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: panelBounds
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <>
      <button
        type="button"
        className={`floating-indicator-ai-trigger${open ? ' open' : ''}`}
        aria-label={TEXT.title}
        title={TEXT.title}
        style={{ left: triggerPos.x, top: triggerPos.y }}
        onPointerDown={startTriggerDrag}
        onClick={event => {
          event.preventDefault();
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setOpen(current => !current);
        }}
      >
        <RobotOutlined />
        <span>{TEXT.open}</span>
      </button>

      {open ? (
        <aside
          className="floating-indicator-ai-panel"
          style={{ left: panelBounds.x, top: panelBounds.y, width: panelBounds.width, height: panelBounds.height }}
        >
          <div className="floating-indicator-ai-head" onPointerDown={startPanelDrag}>
            <div className="floating-indicator-ai-title">
              <RobotOutlined />
              <span>{TEXT.title}</span>
            </div>
            <Button
              type="text"
              size="small"
              className="floating-indicator-ai-close"
              icon={<CloseOutlined />}
              aria-label="关闭 AI 面板"
              onPointerDown={event => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
              }}
            />
          </div>

          <div className="floating-indicator-ai-subtitle">{props.pageTitle}</div>

          <div className="floating-indicator-ai-actions">
            <Button size="small" onClick={() => void submitPrompt('请对当前页面现有指标做一次全局分析')}>
              {TEXT.demo}
            </Button>
          </div>

          <div className="floating-indicator-ai-messages" ref={messagesRef}>
            {messages.map(item => (
              <div key={item.id} className={`floating-indicator-ai-message floating-indicator-ai-message-${item.role}`}>
                <div className="floating-indicator-ai-bubble">{item.content}</div>
              </div>
            ))}
          </div>

          <div className="floating-indicator-ai-compose">
            <Input.TextArea
              value={input}
              placeholder={TEXT.placeholder}
              autoSize={{ minRows: 3, maxRows: 5 }}
              disabled={loading || availableCharts.length === 0}
              onChange={event => setInput(event.target.value)}
              onPressEnter={event => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void submitPrompt(input);
                }
              }}
            />
            <div className="floating-indicator-ai-compose-actions">
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={loading}
                disabled={availableCharts.length === 0}
                onClick={() => void submitPrompt(input)}
              >
                {TEXT.send}
              </Button>
            </div>
          </div>

          <button
            type="button"
            className="floating-indicator-ai-resize-handle"
            aria-label="调整 AI 面板大小"
            onPointerDown={startResize}
          />
        </aside>
      ) : null}
    </>
  );
}
