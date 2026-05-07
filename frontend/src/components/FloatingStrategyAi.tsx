import { CheckOutlined, CloseOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Input, message } from 'antd';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../api/client';
import type { ChartPreview } from '../types/dashboard';
import { buildChartRuntimeCards } from '../utils/chartLibrary';
import { createStrategy, listMyStrategies, type StrategyChartSnapshot } from '../utils/strategies';

type StrategyAiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type StrategyAiChartContext = {
  id: string;
  title: string;
  preview?: ChartPreview;
};

type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };

type DragState =
  | { mode: 'trigger'; pointerId: number; start: Point; origin: Point }
  | { mode: 'panel'; pointerId: number; start: Point; origin: Bounds }
  | { mode: 'resize'; pointerId: number; start: Point; origin: Bounds }
  | null;

type StrategyProposal = {
  id: string;
  strategyName: string;
  description: string;
  charts: StrategyChartSnapshot[];
};

const STORAGE_KEY = 'strategy-dashboard-strategy-ai-floating-v2';
const TRIGGER_SIZE = 59;
const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 700;
const MIN_PANEL_WIDTH = 340;
const MIN_PANEL_HEIGHT = 360;

const TEXT = {
  title: 'TKF智能体助手',
  pageTitle: '策略页智能助手',
  open: 'TKF智能体助手',
  placeholder: '例如：创建一个风格周期定位策略，或者帮我总结当前策略变化',
  send: '发送',
  demo: '创建演示策略',
  greeting: '我可以帮你根据对话生成策略演示方案。比如你说“创建一个风格周期定位策略”，我会组装对应策略并支持一键保存到我的策略。',
  save: '确定保存',
  created: '策略已保存到我的策略',
  createFailed: '创建策略失败',
  noTemplate: '当前没有找到用于组装风格周期定位策略的模板图表。',
  duplicated: '我的策略里已经有同名策略了，我为你追加了一个新版本名称。'
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeTrigger(point: Point) {
  return {
    x: clamp(point.x, 16, window.innerWidth - TRIGGER_SIZE - 16),
    y: clamp(point.y, 16, window.innerHeight - TRIGGER_SIZE - 16)
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
        x: search.getBoundingClientRect().left - TRIGGER_SIZE - 12,
        y: search.getBoundingClientRect().top + ((search.getBoundingClientRect().height - TRIGGER_SIZE) / 2)
      })
    : normalizeTrigger({
        x: window.innerWidth - TRIGGER_SIZE - 332,
        y: 118
      });

  return {
    trigger,
    panel: normalizePanel({
      x: trigger.x,
      y: trigger.y + 58,
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT
    })
  };
}

function buildSummary(title: string, preview?: ChartPreview) {
  const metric = preview?.queryDsl.metrics?.[0];
  const dimension = preview?.queryDsl.dimensionFields?.[0];
  if (!metric || !preview) {
    return `${title} 可作为策略结构中的观察项。`;
  }
  const lastRow = preview.rows?.[preview.rows.length - 1];
  if (!lastRow) {
    return `${title} 当前暂无可用样本。`;
  }
  const label = String((dimension ? lastRow[dimension] : undefined) ?? '最新一期');
  const value = lastRow[metric.fieldCode];
  return `${title} 在 ${label} 的最新值为 ${String(value ?? '-')}`;
}

function buildFallbackReply(pageTitle: string, charts: StrategyAiChartContext[], prompt: string) {
  const normalizedPrompt = prompt.trim().toLowerCase();
  const summaries = charts.slice(0, 5).map(chart => buildSummary(chart.title, chart.preview));
  if (normalizedPrompt.includes('创建') || normalizedPrompt.includes('策略')) {
    return `如果你要创建策略，我可以先根据现有模板组装一个演示版本，再由你确认保存。\n当前可参考的图表有：\n${summaries.join('\n')}`;
  }
  return `我先结合“${pageTitle}”里的内容给你做个简要解读：\n${summaries.join('\n')}`;
}

function normalizeCreatePrompt(prompt: string) {
  return prompt.replace(/\s+/g, '').toLowerCase();
}

function isCreateCycleStrategyPrompt(prompt: string) {
  const normalized = normalizeCreatePrompt(prompt);
  return normalized.includes('创建')
    && (normalized.includes('风格周期') || normalized.includes('周期定位'))
    && normalized.includes('策略');
}

function resolvePersonalStrategyName(baseName: string) {
  const existingNames = new Set(listMyStrategies().map(item => item.strategyName));
  if (!existingNames.has(baseName)) {
    return { name: baseName, duplicated: false };
  }
  let index = 2;
  let nextName = `${baseName}${index}`;
  while (existingNames.has(nextName)) {
    index += 1;
    nextName = `${baseName}${index}`;
  }
  return { name: nextName, duplicated: true };
}

async function buildCycleStrategyProposal() {
  const [ruleCards, trendCards] = await Promise.all([
    buildChartRuntimeCards('chart_91'),
    buildChartRuntimeCards('chart_171')
  ]);
  const selectedCards = [...ruleCards, ...trendCards]
    .filter(card => (
      card.component.dslConfig.visualDsl.title.includes('三因素风格周期')
      || card.component.title.includes('三因素风格周期')
    ))
    .slice(0, 2);
  if (selectedCards.length < 2) {
    return undefined;
  }
  const { name, duplicated } = resolvePersonalStrategyName('三因素风格周期定位策略');
  return {
    duplicated,
    proposal: {
      id: `proposal-${Date.now()}`,
      strategyName: name,
      description: '基于三因素风格周期定位规则与趋势图的演示策略',
      charts: selectedCards.map(card => ({
        chartId: `${card.chartCode}:${card.component.componentCode}`,
        chartCode: card.chartCode,
        chartName: card.chartName,
        componentCode: card.component.componentCode,
        componentTitle: card.component.dslConfig.visualDsl.title || card.component.title,
        templateCode: card.component.templateCode,
        modelCode: card.component.modelCode,
        dslConfig: card.component.dslConfig,
        addedAt: new Date().toISOString()
      }))
    } satisfies StrategyProposal
  };
}

export default function FloatingStrategyAi(props: {
  storageKey: string;
  pageTitle: string;
  charts: StrategyAiChartContext[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<StrategyAiMessage[]>([
    { id: 'assistant-initial', role: 'assistant', content: TEXT.greeting }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [triggerPos, setTriggerPos] = useState<Point>({ x: 16, y: 16 });
  const [panelBounds, setPanelBounds] = useState<Bounds>({ x: 16, y: 72, width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const [proposal, setProposal] = useState<StrategyProposal>();
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
    setMessages([{ id: `assistant-${props.storageKey}`, role: 'assistant', content: TEXT.greeting }]);
    setInput('');
    setLoading(false);
    setOpen(false);
    setProposal(undefined);
  }, [props.storageKey]);

  useEffect(() => {
    if (!messagesRef.current) {
      return;
    }
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading, proposal]);

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

  const appendMessage = (messageItem: StrategyAiMessage) => {
    setMessages(current => [...current, messageItem]);
  };

  const saveProposal = () => {
    if (!proposal) {
      return;
    }
    createStrategy({
      scope: 'personal',
      strategyName: proposal.strategyName,
      description: proposal.description,
      charts: proposal.charts
    });
    message.success(TEXT.created);
    setProposal(undefined);
    appendMessage({
      id: `assistant-saved-${Date.now()}`,
      role: 'assistant',
      content: `已经帮你把“${proposal.strategyName}”保存到我的策略里了。`
    });
  };

  const submitPrompt = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) {
      return;
    }

    appendMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed
    });
    setInput('');
    setProposal(undefined);

    if (isCreateCycleStrategyPrompt(trimmed)) {
      setLoading(true);
      try {
        const next = await buildCycleStrategyProposal();
        if (!next) {
          appendMessage({
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: TEXT.noTemplate
          });
          return;
        }
        if (next.duplicated) {
          message.info(TEXT.duplicated);
        }
        setProposal(next.proposal);
        appendMessage({
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: `我已经为你组装好了一个演示策略：“${next.proposal.strategyName}”。它会包含“三因素风格周期定位”和“三因素风格周期走势图”两张图，用来做周期状态判断和月度解读。你确认的话，点击下方“确定保存”就会直接进入我的策略。`
        });
      } catch (error) {
        console.error(error);
        message.error(TEXT.createFailed);
      } finally {
        setLoading(false);
      }
      return;
    }

    const assistantMessageId = `assistant-${Date.now()}`;
    appendMessage({
      id: assistantMessageId,
      role: 'assistant',
      content: ''
    });

    const chartContexts = availableCharts.slice(0, 8).map(chart => ({
      title: chart.title,
      summary: buildSummary(chart.title, chart.preview),
      meaning: `${chart.title} 可用于当前策略观察`
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
        className={`floating-indicator-ai-trigger floating-strategy-ai-trigger${open ? ' open' : ''}`}
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
        <img className="floating-indicator-ai-trigger-image" src="/TKF-AI.png" alt="" draggable={false} />
      </button>

      {open ? (
        <aside
          className="floating-indicator-ai-panel floating-strategy-ai-panel"
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
              aria-label="关闭 TKF智能体助手面板"
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

          <div className="floating-indicator-ai-subtitle">{props.pageTitle || TEXT.pageTitle}</div>

          <div className="floating-indicator-ai-actions">
            <Button size="small" onClick={() => void submitPrompt('创建一个风格周期定位策略')}>
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

          {proposal ? (
            <div className="floating-strategy-ai-proposal">
              <div className="floating-strategy-ai-proposal-title">{proposal.strategyName}</div>
              <div className="floating-strategy-ai-proposal-desc">{proposal.description}</div>
              <div className="floating-strategy-ai-proposal-charts">
                {proposal.charts.map(chart => (
                  <div key={chart.chartId} className="floating-strategy-ai-proposal-chart">{chart.componentTitle}</div>
                ))}
              </div>
              <div className="floating-strategy-ai-proposal-actions">
                <Button type="primary" icon={<CheckOutlined />} onClick={saveProposal}>
                  {TEXT.save}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="floating-indicator-ai-compose">
            <Input.TextArea
              value={input}
              placeholder={TEXT.placeholder}
              autoSize={{ minRows: 3, maxRows: 5 }}
              disabled={loading}
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
                onClick={() => void submitPrompt(input)}
              >
                {TEXT.send}
              </Button>
            </div>
          </div>

          <button
            type="button"
            className="floating-indicator-ai-resize-handle"
            aria-label="调整 TKF智能体助手面板大小"
            onPointerDown={startResize}
          />
        </aside>
      ) : null}
    </>
  );
}
