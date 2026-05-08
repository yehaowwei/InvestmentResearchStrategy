import { CloseOutlined, DeleteOutlined, PlusOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: ReactNode;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

type CommandOption = {
  label: string;
  prompt: string;
  description: string;
};

type Point = { x: number; y: number };
type Bounds = { x: number; y: number; width: number; height: number };

type DragState =
  | { mode: 'trigger'; pointerId: number; start: Point; origin: Point }
  | { mode: 'panel'; pointerId: number; start: Point; origin: Bounds }
  | { mode: 'resize'; pointerId: number; start: Point; origin: Bounds }
  | null;

const TRIGGER_SIZE = 70.8;
const PANEL_WIDTH = 465;
const PANEL_HEIGHT = 626;
const VIEWPORT_WIDTH = 1920;
const VIEWPORT_HEIGHT = 1080;
const HISTORY_KEY_PREFIX = 'tkf-config-assistant-history';
const DEFAULT_TITLE = 'TKF配置助手';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readAppScale() {
  if (typeof window === 'undefined') {
    return 1;
  }
  const shell = document.querySelector<HTMLElement>('.app-scale-shell');
  const raw = (shell ? window.getComputedStyle(shell).getPropertyValue('--app-scale') : '')
    || window.getComputedStyle(document.documentElement).getPropertyValue('--app-scale')
    || window.getComputedStyle(document.body).getPropertyValue('--app-scale');
  const parsed = Number(raw.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeTrigger(point: Point) {
  return {
    x: clamp(point.x, 16, VIEWPORT_WIDTH - TRIGGER_SIZE - 16),
    y: clamp(point.y, 16, VIEWPORT_HEIGHT - TRIGGER_SIZE - 16)
  };
}

function normalizePanel(bounds: Bounds) {
  const width = PANEL_WIDTH;
  const height = PANEL_HEIGHT;
  return {
    width,
    height,
    x: clamp(bounds.x, 16, Math.max(16, VIEWPORT_WIDTH - width - 16)),
    y: clamp(bounds.y, 72, Math.max(72, VIEWPORT_HEIGHT - height - 16))
  };
}

function positionPanelNearTrigger(trigger: Point) {
  const rightX = trigger.x + TRIGGER_SIZE + 16;
  const leftX = trigger.x - PANEL_WIDTH - 16;
  const x = rightX + PANEL_WIDTH <= VIEWPORT_WIDTH - 16 ? rightX : leftX;
  const y = trigger.y + TRIGGER_SIZE + 16;
  return normalizePanel({ x, y, width: PANEL_WIDTH, height: PANEL_HEIGHT });
}

function defaultLayout() {
  const search = document.querySelector<HTMLElement>('.page-toc-width-search');
  const trigger = search
    ? normalizeTrigger({
        x: search.getBoundingClientRect().left - TRIGGER_SIZE - 12,
        y: search.getBoundingClientRect().top + ((search.getBoundingClientRect().height - TRIGGER_SIZE) / 2)
      })
    : normalizeTrigger({
        x: VIEWPORT_WIDTH - TRIGGER_SIZE - 332,
        y: 118
      });

  return {
    trigger,
    panel: positionPanelNearTrigger(trigger)
  };
}

function readLayout(storageKey: string) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as Partial<Bounds> : undefined;
  } catch {
    return undefined;
  }
}

function writeLayout(storageKey: string, trigger: Point, panel: Bounds) {
  window.localStorage.setItem(storageKey, JSON.stringify({
    x: trigger.x,
    y: trigger.y,
    width: panel.width,
    height: panel.height
  }));
}

function initialMessages(storageKey: string, greeting: ReactNode): Message[] {
  return [{ id: `assistant-initial-${storageKey}`, role: 'assistant', content: greeting }];
}

function historyStorageKey(storageKey: string) {
  return `${HISTORY_KEY_PREFIX}:${storageKey}`;
}

function readConversations(storageKey: string, greeting: ReactNode): Conversation[] {
  try {
    const raw = window.localStorage.getItem(historyStorageKey(storageKey));
    const parsed = raw ? JSON.parse(raw) as Conversation[] : [];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fall back to a fresh local conversation.
  }
  return [{
    id: `conversation-${Date.now()}`,
    title: '新对话',
    messages: initialMessages(storageKey, greeting),
    updatedAt: Date.now()
  }];
}

function writeConversations(storageKey: string, conversations: Conversation[]) {
  const serializable = conversations.slice(0, 20).map(conversation => ({
    ...conversation,
    messages: conversation.messages.map(message => ({
      ...message,
      content: typeof message.content === 'string' ? message.content : '配置草稿已生成，可在当前页面继续操作。'
    }))
  }));
  window.localStorage.setItem(historyStorageKey(storageKey), JSON.stringify(serializable));
}

function isStrategyContext(storageKey: string, pageTitle: string) {
  return /strategy|策略/i.test(storageKey) || pageTitle.includes('策略');
}

function buildDefaultCommands(storageKey: string, pageTitle: string): CommandOption[] {
  if (isStrategyContext(storageKey, pageTitle)) {
    return [{
      label: '自动配置策略',
      prompt: '自动配置一个策略草稿，先根据可用指标生成策略方案',
      description: '先对话生成策略草稿，进入配置页后继续调试'
    }];
  }
  return [{
    label: '自动配置指标',
    prompt: '自动配置一个指标草稿，启用合适的图表展示和交互配置',
    description: '先对话生成指标草稿，进入配置页后继续调试'
  }];
}

function normalizeCommands(
  storageKey: string,
  pageTitle: string,
  quickActions?: Array<{ label: string; prompt: string }>
): CommandOption[] {
  const defaults = buildDefaultCommands(storageKey, pageTitle);
  if (!quickActions?.length) {
    return defaults;
  }
  return [
    defaults[0],
    ...quickActions.map(action => ({
      label: action.label,
      prompt: action.prompt,
      description: '按所选功能生成配置演示'
    }))
  ];
}

export default function FloatingConfigAssistant(props: {
  storageKey: string;
  title?: string;
  pageTitle: string;
  placeholder?: string;
  greeting?: ReactNode;
  quickActions?: Array<{ label: string; prompt: string }>;
  onSubmitPrompt: (prompt: string) => Promise<ReactNode> | ReactNode;
}) {
  const layoutStorageKey = `tkf-config-assistant:${props.storageKey}`;
  const greeting = props.greeting ?? (
    isStrategyContext(props.storageKey, props.pageTitle)
      ? '我可以先通过对话为你生成策略配置草稿，不会直接发布。生成后你可以进入配置页继续调整。'
      : '我可以先通过对话为你生成指标配置草稿，不会直接发布。生成后你可以进入配置页继续调整。'
  );
  const commandOptions = useMemo(
    () => normalizeCommands(props.storageKey, props.pageTitle, props.quickActions),
    [props.pageTitle, props.quickActions, props.storageKey]
  );
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(() => readConversations(props.storageKey, greeting));
  const [activeConversationId, setActiveConversationId] = useState(() => readConversations(props.storageKey, greeting)[0]?.id ?? `conversation-${Date.now()}`);
  const activeConversation = conversations.find(item => item.id === activeConversationId) ?? conversations[0];
  const messages = activeConversation?.messages ?? initialMessages(props.storageKey, greeting);
  const [input, setInput] = useState('');
  const [selectedCommand, setSelectedCommand] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [triggerPos, setTriggerPos] = useState<Point>({ x: 16, y: 16 });
  const [panelBounds, setPanelBounds] = useState<Bounds>({ x: 16, y: 72, width: PANEL_WIDTH, height: PANEL_HEIGHT });
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const saved = readLayout(layoutStorageKey);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const trigger = normalizeTrigger({ x: Number(saved.x), y: Number(saved.y) });
      setTriggerPos(trigger);
      setPanelBounds(positionPanelNearTrigger(trigger));
      return;
    }
    const apply = () => {
      const next = defaultLayout();
      setTriggerPos(next.trigger);
      setPanelBounds(next.panel);
    };
    const frame = window.requestAnimationFrame(() => {
      apply();
      window.setTimeout(apply, 120);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [layoutStorageKey]);

  useEffect(() => {
    const handleResize = () => {
      setTriggerPos(current => normalizeTrigger(current));
      setPanelBounds(current => normalizePanel(current));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const nextConversations = readConversations(props.storageKey, greeting);
    setConversations(nextConversations);
    setActiveConversationId(nextConversations[0]?.id ?? `conversation-${Date.now()}`);
    setInput('');
    setSelectedCommand(undefined);
    setLoading(false);
    setOpen(false);
  }, [greeting, props.storageKey]);

  useEffect(() => {
    writeConversations(props.storageKey, conversations);
  }, [conversations, props.storageKey]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      const appScale = readAppScale();
      const dx = (event.clientX - state.start.x) / appScale;
      const dy = (event.clientY - state.start.y) / appScale;

      if (state.mode === 'trigger') {
        suppressClickRef.current = suppressClickRef.current || Math.abs(dx) > 4 || Math.abs(dy) > 4;
        setTriggerPos(normalizeTrigger({ x: state.origin.x + dx, y: state.origin.y + dy }));
        return;
      }
      if (state.mode === 'panel') {
        setPanelBounds(normalizePanel({ ...state.origin, x: state.origin.x + dx, y: state.origin.y + dy }));
        return;
      }
      setPanelBounds(normalizePanel({ ...state.origin, width: state.origin.width + dx, height: state.origin.height + dy }));
    };

    const onPointerEnd = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      dragStateRef.current = null;
      writeLayout(layoutStorageKey, triggerPos, panelBounds);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [layoutStorageKey, panelBounds, triggerPos]);

  const appendMessage = (message: Message) => {
    setConversations(current => current.map(conversation => (
      conversation.id === activeConversationId
        ? {
            ...conversation,
            title: conversation.title === '新对话' && message.role === 'user'
              ? String(message.content).slice(0, 18)
              : conversation.title,
            messages: [...conversation.messages, message],
            updatedAt: Date.now()
          }
        : conversation
    )));
  };

  const createConversation = () => {
    const conversation: Conversation = {
      id: `conversation-${Date.now()}`,
      title: '新对话',
      messages: initialMessages(props.storageKey, greeting),
      updatedAt: Date.now()
    };
    setConversations(current => [conversation, ...current]);
    setActiveConversationId(conversation.id);
    setInput('');
    setSelectedCommand(undefined);
  };

  const deleteConversation = () => {
    setConversations(current => {
      const next = current.filter(item => item.id !== activeConversationId);
      if (next.length > 0) {
        setActiveConversationId(next[0].id);
        return next;
      }
      const fallback: Conversation = {
        id: `conversation-${Date.now()}`,
        title: '新对话',
        messages: initialMessages(props.storageKey, greeting),
        updatedAt: Date.now()
      };
      setActiveConversationId(fallback.id);
      return [fallback];
    });
    setInput('');
    setSelectedCommand(undefined);
  };

  const applyCommand = (option: CommandOption) => {
    setSelectedCommand(option.label);
    setInput('');
  };

  const submitPrompt = async (prompt: string) => {
    const rawPrompt = prompt.trim();
    const trimmed = selectedCommand ? `【${selectedCommand}】${rawPrompt || commandOptions.find(item => item.label === selectedCommand)?.prompt || ''}` : rawPrompt;
    if (!trimmed || loading) return;
    setInput('');
    setSelectedCommand(undefined);
    appendMessage({ id: `user-${Date.now()}`, role: 'user', content: trimmed });
    setLoading(true);
    try {
      const reply = await props.onSubmitPrompt(trimmed);
      appendMessage({ id: `assistant-${Date.now()}`, role: 'assistant', content: reply });
    } catch (error) {
      appendMessage({
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: error instanceof Error ? error.message : '配置助手执行失败'
      });
    } finally {
      setLoading(false);
    }
  };

  const startTriggerDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStateRef.current = { mode: 'trigger', pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: triggerPos };
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startPanelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.floating-indicator-ai-close')) return;
    dragStateRef.current = { mode: 'panel', pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: panelBounds };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = { mode: 'resize', pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: panelBounds };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return (
    <>
      <button
        type="button"
        className={`floating-indicator-ai-trigger floating-config-assistant-trigger${open ? ' open' : ''}`}
        aria-label={props.title ?? DEFAULT_TITLE}
        title={props.title ?? DEFAULT_TITLE}
        style={{ left: triggerPos.x, top: triggerPos.y }}
        onPointerDown={startTriggerDrag}
        onClick={event => {
          event.preventDefault();
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setPanelBounds(positionPanelNearTrigger(triggerPos));
          setOpen(current => !current);
        }}
      >
        <img className="floating-indicator-ai-trigger-image" src="/TKF-配置助手.png" alt="" draggable={false} />
      </button>

      {open ? (
        <aside
          className="floating-indicator-ai-panel floating-config-assistant-panel"
          style={{ left: panelBounds.x, top: panelBounds.y, width: panelBounds.width, height: panelBounds.height }}
        >
          <div className="floating-indicator-ai-head" onPointerDown={startPanelDrag}>
            <div className="floating-indicator-ai-title">
              <RobotOutlined />
              <span>{props.title ?? DEFAULT_TITLE}</span>
            </div>
            <Button
              type="text"
              size="small"
              className="floating-indicator-ai-close"
              icon={<CloseOutlined />}
              aria-label={`关闭${props.title ?? DEFAULT_TITLE}`}
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

          <div className="floating-ai-session-bar">
            <select
              className="floating-ai-session-select"
              value={activeConversationId}
              onChange={event => setActiveConversationId(event.target.value)}
            >
              {conversations.map(conversation => (
                <option key={conversation.id} value={conversation.id}>
                  {conversation.title}
                </option>
              ))}
            </select>
            <Button size="small" icon={<PlusOutlined />} onClick={createConversation}>
              新对话
            </Button>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={deleteConversation}>
              删除
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
            {input.trim() === '/' ? (
              <div className="floating-ai-command-menu">
                {commandOptions.map(option => (
                  <button key={option.label} type="button" onClick={() => applyCommand(option)}>
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                  </button>
                ))}
              </div>
            ) : null}
            {selectedCommand ? (
              <div className="floating-ai-selected-command">
                <span>{selectedCommand}</span>
                <button type="button" onClick={() => setSelectedCommand(undefined)}>取消</button>
              </div>
            ) : null}
            <Input.TextArea
              value={input}
              placeholder={`${props.placeholder ?? '描述你想创建或修改的配置'}，输入 / 选择功能`}
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
              <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={() => void submitPrompt(input)}>
                发送
              </Button>
            </div>
          </div>

          <button
            type="button"
            className="floating-indicator-ai-resize-handle"
            aria-label={`调整${props.title ?? DEFAULT_TITLE}面板大小`}
            onPointerDown={startResize}
          />
        </aside>
      ) : null}
    </>
  );
}
