import { ArrowDownOutlined, ArrowLeftOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, SaveOutlined, TagsOutlined } from '@ant-design/icons';
import { Button, Empty, Input, InputNumber, Modal, Space, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardCanvas from '../components/DashboardCanvas';
import { api } from '../api/client';
import type { ChartPreview, DashboardComponent, FavoriteChart, PersonalBoard } from '../types/dashboard';
import {
  createPersonalBoard,
  deletePersonalBoard,
  getPersonalBoard,
  listPersonalBoards,
  removeComponentFromBoard,
  saveFavoriteLayouts,
  updatePersonalBoard
} from '../utils/favorites';

function toComponent(item: FavoriteChart): DashboardComponent {
  return {
    componentCode: item.componentCode,
    componentType: 'chart',
    templateCode: item.templateCode,
    modelCode: item.modelCode,
    title: item.componentTitle,
    dslConfig: item.dslConfig
  };
}

function buildBoardComponents(board: PersonalBoard) {
  return board.components.map(toComponent);
}

function createBoardPreviewMap(boards: PersonalBoard[]) {
  return Object.fromEntries(boards.map(board => [board.boardId, {} as Record<string, ChartPreview>]));
}

export default function PersonalDashboard() {
  const navigate = useNavigate();
  const { boardId } = useParams();
  const [boards, setBoards] = useState(listPersonalBoards());
  const [activePrimaryFilter, setActivePrimaryFilter] = useState('全部');
  const [boardPreviews, setBoardPreviews] = useState<Record<string, Record<string, ChartPreview>>>(() => createBoardPreviewMap(boards));
  const [components, setComponents] = useState<DashboardComponent[]>([]);
  const [selectedComponentCode, setSelectedComponentCode] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingBoardId, setEditingBoardId] = useState<string>();
  const [primaryLabelInput, setPrimaryLabelInput] = useState('');
  const [secondaryLabelInput, setSecondaryLabelInput] = useState('');
  const [boardOrderInput, setBoardOrderInput] = useState(1);

  const currentBoard = useMemo(
    () => (boardId ? getPersonalBoard(boardId) : undefined),
    [boardId, boards]
  );

  const groupedBoards = useMemo(() => {
    const map = new Map<string, PersonalBoard[]>();
    boards.forEach(board => {
      const key = board.primaryLabel || '未分组';
      map.set(key, [...(map.get(key) ?? []), board]);
    });
    return [...map.entries()];
  }, [boards]);

  const primaryFilterOptions = useMemo(
    () => ['全部', ...groupedBoards.map(([primaryLabel]) => primaryLabel)],
    [groupedBoards]
  );

  const filteredGroupedBoards = useMemo(
    () => activePrimaryFilter === '全部'
      ? groupedBoards
      : groupedBoards.filter(([primaryLabel]) => primaryLabel === activePrimaryFilter),
    [activePrimaryFilter, groupedBoards]
  );

  useEffect(() => {
    const syncBoards = () => {
      const nextBoards = listPersonalBoards();
      setBoards(nextBoards);
      setBoardPreviews(current => {
        const next = createBoardPreviewMap(nextBoards);
        nextBoards.forEach(board => {
          next[board.boardId] = current[board.boardId] ?? {};
        });
        return next;
      });

      if (!boardId) {
        setComponents([]);
        setSelectedComponentCode(undefined);
        setDirty(false);
      } else {
        const nextBoard = getPersonalBoard(boardId);
        if (!nextBoard) {
          navigate('/favorites', { replace: true });
          return;
        }
        const nextComponents = buildBoardComponents(nextBoard);
        setComponents(nextComponents);
        setSelectedComponentCode(current => current && nextComponents.some(item => item.componentCode === current)
          ? current
          : nextComponents[0]?.componentCode);
        setDirty(false);
      }

      Promise.all(
        nextBoards.map(async board => {
          if (board.components.length === 0) {
            return [board.boardId, {}] as const;
          }
          const entries = await Promise.all(
            board.components.map(async item => [item.componentCode, await api.previewComponent({ modelCode: item.modelCode, dslConfig: item.dslConfig })] as const)
          );
          return [board.boardId, Object.fromEntries(entries)] as const;
        })
      )
        .then(entries => setBoardPreviews(Object.fromEntries(entries)))
        .catch(error => {
          console.error(error);
          message.error(error instanceof Error ? error.message : '个人指标库加载失败');
        });
    };

    syncBoards();
    window.addEventListener('storage', syncBoards);
    window.addEventListener('bi-dashboard-favorites-changed', syncBoards as EventListener);
    return () => {
      window.removeEventListener('storage', syncBoards);
      window.removeEventListener('bi-dashboard-favorites-changed', syncBoards as EventListener);
    };
  }, [boardId, navigate]);

  useEffect(() => {
    if (activePrimaryFilter === '全部') return;
    if (!primaryFilterOptions.includes(activePrimaryFilter)) {
      setActivePrimaryFilter('全部');
    }
  }, [activePrimaryFilter, primaryFilterOptions]);

  const openCreateBoard = () => {
    setEditingBoardId('create');
    setPrimaryLabelInput('');
    setSecondaryLabelInput('');
    setBoardOrderInput(boards.length + 1);
  };

  const openRenameBoard = () => {
    if (!currentBoard) return;
    setEditingBoardId(currentBoard.boardId);
    setPrimaryLabelInput(currentBoard.primaryLabel || '');
    setSecondaryLabelInput(currentBoard.secondaryLabel || currentBoard.boardName);
    setBoardOrderInput(currentBoard.order);
  };

  const deleteBoard = (targetBoard: PersonalBoard) => {
    deletePersonalBoard(targetBoard.boardId);
    const nextBoards = listPersonalBoards();
    setBoards(nextBoards);
    setBoardPreviews(current => {
      const next = { ...current };
      delete next[targetBoard.boardId];
      return next;
    });
    if (boardId === targetBoard.boardId) {
      navigate('/favorites');
    }
    message.success('个人指标看板已删除');
  };

  const boardCards = (
    <div className="favorites-group-list">
      {filteredGroupedBoards.map(([primaryLabel, items]) => (
        <section key={primaryLabel} className="favorites-group-section">
          <div className="favorites-group-head">
            <Space>
              <TagsOutlined />
              <h3 className="favorites-group-title">{primaryLabel}</h3>
              <Tag>{items.length} 个看板</Tag>
            </Space>
          </div>
          <div className="favorites-board-grid">
            {items.map(board => {
              const previewComponents = buildBoardComponents(board);
              const previews = boardPreviews[board.boardId] ?? {};
              return (
                <article key={board.boardId} className="panel-card favorites-board-card">
                  <div className="favorites-board-card-head">
                    <div>
                      <div className="favorites-board-tags">
                        <Tag color="cyan">{board.primaryLabel || '未分组'}</Tag>
                        <Tag>{board.secondaryLabel || board.boardName}</Tag>
                      </div>
                      <h3 className="favorites-board-title">{board.secondaryLabel || board.boardName}</h3>
                      <div className="favorites-board-meta">
                        <span>排序 {board.order}</span>
                        <span>{board.components.length} 个图表</span>
                      </div>
                    </div>
                    <Space wrap>
                      <Button icon={<EyeOutlined />} onClick={() => navigate(`/favorites/${board.boardId}`)}>查看</Button>
                      <Button icon={<DeleteOutlined />} danger onClick={() => deleteBoard(board)}>删除</Button>
                    </Space>
                  </div>
                  <div className="favorites-board-thumb">
                    <DashboardCanvas
                      components={previewComponents}
                      previews={previews}
                      editable={false}
                      selectedComponentCode={undefined}
                      onSelect={() => undefined}
                      onLayoutChange={() => undefined}
                      mode="thumbnail"
                      emptyContent={<Empty description="当前看板还没有图表" />}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  const currentPreviews = currentBoard ? (boardPreviews[currentBoard.boardId] ?? {}) : {};

  return (
    <>
      <div className="page-header">
        <Space wrap>
          {!boardId ? null : (
            <Button icon={<ArrowLeftOutlined />}>
              <Link to="/favorites">返回看板列表</Link>
            </Button>
          )}
          <Button icon={<PlusOutlined />} onClick={openCreateBoard}>新建看板</Button>
          {boardId ? (
            <>
              <Button icon={<EditOutlined />} onClick={openRenameBoard} disabled={!currentBoard}>修改标签</Button>
              <Button
                icon={<ArrowUpOutlined />}
                disabled={!currentBoard}
                onClick={() => {
                  if (!currentBoard) return;
                  updatePersonalBoard(currentBoard.boardId, { order: Math.max(1, currentBoard.order - 1) });
                  setBoards(listPersonalBoards());
                }}
              >
                排序前移
              </Button>
              <Button
                icon={<ArrowDownOutlined />}
                disabled={!currentBoard}
                onClick={() => {
                  if (!currentBoard) return;
                  updatePersonalBoard(currentBoard.boardId, { order: currentBoard.order + 1 });
                  setBoards(listPersonalBoards());
                }}
              >
                排序后移
              </Button>
              <Button danger icon={<DeleteOutlined />} disabled={!currentBoard} onClick={() => currentBoard && deleteBoard(currentBoard)}>
                删除看板
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={!dirty || components.length === 0 || !currentBoard}
                loading={saving}
                onClick={async () => {
                  if (!currentBoard) return;
                  setSaving(true);
                  try {
                    saveFavoriteLayouts(currentBoard.boardId, components);
                    setDirty(false);
                    message.success('个人指标看板布局已保存');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                保存布局
              </Button>
            </>
          ) : null}
        </Space>
        <div>
          <h2 className="page-title">{boardId ? (currentBoard?.secondaryLabel || currentBoard?.boardName || '个人指标库') : '个人指标库'}</h2>
          {boardId ? <div className="page-subtitle">{`${currentBoard?.primaryLabel || '未分组'} / ${currentBoard?.secondaryLabel || currentBoard?.boardName || ''}`}</div> : null}
        </div>
      </div>

      {!boardId && boards.length > 0 ? (
        <div className="favorites-filter-nav">
          {primaryFilterOptions.map(option => (
            <Button
              key={option}
              type={activePrimaryFilter === option ? 'primary' : 'default'}
              onClick={() => setActivePrimaryFilter(option)}
            >
              {option}
            </Button>
          ))}
        </div>
      ) : null}

      {!boardId ? (
        boards.length > 0 ? boardCards : <div className="panel-card canvas-card canvas-empty"><Empty description="当前个人指标库还没有看板" /></div>
      ) : currentBoard ? (
        <DashboardCanvas
          components={components}
          previews={currentPreviews}
          editable
          selectedComponentCode={selectedComponentCode}
          onSelect={setSelectedComponentCode}
          onLayoutChange={nextComponents => {
            setComponents(nextComponents);
            setDirty(true);
          }}
          emptyContent={<Empty description="当前个人指标看板还没有图表" />}
          renderActions={component => (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                if (!currentBoard) return;
                removeComponentFromBoard(currentBoard.boardId, component.componentCode);
                setComponents(current => current.filter(item => item.componentCode !== component.componentCode));
                setBoardPreviews(current => ({
                  ...current,
                  [currentBoard.boardId]: Object.fromEntries(
                    Object.entries(current[currentBoard.boardId] ?? {}).filter(([code]) => code !== component.componentCode)
                  )
                }));
                setSelectedComponentCode(current => current === component.componentCode
                  ? components.find(item => item.componentCode !== component.componentCode)?.componentCode
                  : current);
                message.success('图表已从当前看板移除');
              }}
            >
              删除图表
            </Button>
          )}
        />
      ) : (
        <div className="panel-card canvas-card canvas-empty"><Empty description="未找到对应的个人看板" /></div>
      )}

      <Modal
        title={editingBoardId === 'create' ? '新建个人指标看板' : '修改个人指标看板标签'}
        open={Boolean(editingBoardId)}
        okText="确认"
        cancelText="取消"
        onCancel={() => setEditingBoardId(undefined)}
        onOk={() => {
          const primaryLabel = primaryLabelInput.trim();
          const secondaryLabel = secondaryLabelInput.trim();
          if (!primaryLabel || !secondaryLabel) {
            message.warning('请填写一级标签和二级标签');
            return;
          }
          if (editingBoardId === 'create') {
            const nextBoard = createPersonalBoard(secondaryLabel, { primaryLabel, secondaryLabel });
            updatePersonalBoard(nextBoard.boardId, { order: boardOrderInput });
            setBoards(listPersonalBoards());
            navigate(`/favorites/${nextBoard.boardId}`);
            message.success('个人指标看板已创建');
          } else if (editingBoardId) {
            updatePersonalBoard(editingBoardId, { primaryLabel, secondaryLabel, order: boardOrderInput });
            setBoards(listPersonalBoards());
            message.success('个人指标看板已更新');
          }
          setEditingBoardId(undefined);
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Input value={primaryLabelInput} onChange={event => setPrimaryLabelInput(event.target.value)} placeholder="一级标签" />
          <Input value={secondaryLabelInput} onChange={event => setSecondaryLabelInput(event.target.value)} placeholder="二级标签 / 看板名称" />
          <InputNumber style={{ width: '100%' }} min={1} value={boardOrderInput} onChange={value => setBoardOrderInput(Number(value ?? 1))} addonBefore="排序" />
        </Space>
      </Modal>
    </>
  );
}
