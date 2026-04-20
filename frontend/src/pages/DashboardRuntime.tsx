import { EyeOutlined, StarFilled, StarOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Select, Space, Spin, Tag, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import DashboardCanvas from '../components/DashboardCanvas';
import type { ChartPreview, DashboardDraft, DashboardSummary } from '../types/dashboard';
import { normalizeDashboard, normalizeDisplayText } from '../utils/dashboard';
import {
  addComponentToBoard,
  createBoardFromDashboard,
  createPersonalBoard,
  isDashboardFavorited,
  isFavorite,
  listPersonalBoards,
  removeComponentFromAllBoards
} from '../utils/favorites';
import { DASHBOARD_CATEGORIES, filterDashboardsByCategory, getCategoryLabel, normalizeCategoryKey } from '../utils/dashboardCatalog';

export default function DashboardRuntime() {
  const navigate = useNavigate();
  const params = useParams();
  const category = normalizeCategoryKey(params.categoryKey);
  const dashboardCode = params.dashboardCode;
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [dashboard, setDashboard] = useState<DashboardDraft>();
  const [previews, setPreviews] = useState<Record<string, ChartPreview>>({});
  const [runtimeBoards, setRuntimeBoards] = useState<Record<string, DashboardDraft>>({});
  const [runtimeBoardPreviews, setRuntimeBoardPreviews] = useState<Record<string, Record<string, ChartPreview>>>({});
  const [favoriteCodes, setFavoriteCodes] = useState<string[]>([]);
  const [favoritedDashboardCodes, setFavoritedDashboardCodes] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [collectingComponentCode, setCollectingComponentCode] = useState<string>();
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [newPrimaryLabel, setNewPrimaryLabel] = useState('');
  const [newSecondaryLabel, setNewSecondaryLabel] = useState('');

  const boards = useMemo(() => listPersonalBoards(), [favoriteCodes, favoritedDashboardCodes, collectingComponentCode]);
  const categoryDashboards = useMemo(() => filterDashboardsByCategory(dashboards, category, true), [dashboards, category]);
  const collectingComponent = dashboard?.components.find(item => item.componentCode === collectingComponentCode);

  useEffect(() => {
    api.listDashboards()
      .then(setDashboards)
      .catch(loadError => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : '公共指标库加载失败');
      });
  }, []);

  useEffect(() => {
    if (!dashboardCode) {
      setDashboard(undefined);
      setPreviews({});
      return;
    }

    setError(undefined);
    api.loadRuntime(dashboardCode)
      .then(async runtime => {
        const normalized = normalizeDashboard(runtime.dashboard);
        setDashboard(normalized);
        const previewPairs = await Promise.all(
          normalized.components.map(async component => [component.componentCode, await api.previewComponent(component)] as const)
        );
        setPreviews(Object.fromEntries(previewPairs));
      })
      .catch(loadError => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : '公共指标库加载失败');
      });
  }, [dashboardCode]);

  useEffect(() => {
    if (dashboardCode || categoryDashboards.length === 0) {
      return;
    }

    let cancelled = false;
    Promise.all(
      categoryDashboards.map(async item => {
        const runtime = await api.loadRuntime(item.dashboardCode);
        const normalized = normalizeDashboard(runtime.dashboard);
        const firstComponent = normalized.components[0];
        const firstPreview = firstComponent ? await api.previewComponent(firstComponent) : undefined;
        return {
          dashboardCode: item.dashboardCode,
          dashboard: normalized,
          previews: firstComponent && firstPreview ? { [firstComponent.componentCode]: firstPreview } : {}
        };
      })
    )
      .then(entries => {
        if (cancelled) return;
        setRuntimeBoards(Object.fromEntries(entries.map(entry => [entry.dashboardCode, entry.dashboard])));
        setRuntimeBoardPreviews(Object.fromEntries(entries.map(entry => [entry.dashboardCode, entry.previews])));
      })
      .catch(loadError => {
        console.error(loadError);
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : '公共指标库加载失败');
      });

    return () => {
      cancelled = true;
    };
  }, [categoryDashboards, dashboardCode]);

  useEffect(() => {
    const syncFavorites = () => {
      const nextBoards = listPersonalBoards();
      setFavoritedDashboardCodes(
        [...new Set(
          nextBoards
            .filter(board => board.components.length > 0 && board.components.every(item => item.dashboardCode === board.components[0].dashboardCode))
            .map(board => board.components[0].dashboardCode)
        )]
      );

      if (!dashboard) {
        setFavoriteCodes([]);
        return;
      }

      setFavoriteCodes(
        dashboard.components
          .filter(component => isFavorite(component.componentCode))
          .map(component => component.componentCode)
      );
    };

    syncFavorites();
    window.addEventListener('storage', syncFavorites);
    window.addEventListener('bi-dashboard-favorites-changed', syncFavorites as EventListener);
    return () => {
      window.removeEventListener('storage', syncFavorites);
      window.removeEventListener('bi-dashboard-favorites-changed', syncFavorites as EventListener);
    };
  }, [dashboard]);

  const resetCollectModal = () => {
    setCollectingComponentCode(undefined);
    setSelectedBoardIds([]);
    setShowCreateBoard(false);
    setNewPrimaryLabel('');
    setNewSecondaryLabel('');
  };

  const collectWholeBoard = (targetDashboard: DashboardDraft) => {
    const existed = isDashboardFavorited(targetDashboard);
    createBoardFromDashboard(targetDashboard, category);
    if (!existed) {
      setFavoritedDashboardCodes(state => [...new Set([...state, targetDashboard.dashboardCode])]);
    }
    message.success(existed ? '该看板已在个人指标库中' : '整个看板已加入个人指标库');
  };

  const runtimeCards = (
    <div className="favorites-board-grid">
      {categoryDashboards.map(item => {
        const full = runtimeBoards[item.dashboardCode];
        const previewComponent = full?.components[0];
        const previewMap = runtimeBoardPreviews[item.dashboardCode] ?? {};
        const boardFavorited = full ? favoritedDashboardCodes.includes(full.dashboardCode) : false;
        return (
          <article key={item.dashboardCode} className="panel-card favorites-board-card public-board-card">
            <div className="favorites-board-card-head">
              <div>
                <div className="favorites-board-tags">
                  <Tag color="cyan">{getCategoryLabel(category)}</Tag>
                  <Tag>{normalizeDisplayText(item.name, item.dashboardCode)}</Tag>
                </div>
                <h3 className="favorites-board-title">{normalizeDisplayText(item.name, item.dashboardCode)}</h3>
                <div className="favorites-board-meta">
                  <span>{full?.components.length ?? 0} 个图表</span>
                  <span>{item.dashboardCode}</span>
                </div>
              </div>
              <Space wrap>
                <Button icon={<EyeOutlined />} onClick={() => navigate(`/runtime/${category}/${item.dashboardCode}`)}>进入看板</Button>
                <Button
                  icon={boardFavorited ? <StarFilled /> : <StarOutlined />}
                  type={boardFavorited ? 'primary' : 'default'}
                  onClick={() => full && collectWholeBoard(full)}
                  disabled={!full}
                >
                  {boardFavorited ? '已收藏整个看板' : '收藏整个看板'}
                </Button>
              </Space>
            </div>
            <div className="favorites-board-thumb">
              {full && previewComponent ? (
                <DashboardCanvas
                  components={[previewComponent]}
                  previews={previewMap}
                  editable={false}
                  selectedComponentCode={undefined}
                  onSelect={() => undefined}
                  onLayoutChange={() => undefined}
                  mode="thumbnail"
                />
              ) : (
                <div className="panel-card canvas-card canvas-empty"><Spin /></div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );

  if (error) {
    return <Alert type="error" showIcon message="公共指标库加载失败" description={error} />;
  }

  if (!dashboardCode) {
    return (
      <div>
        <div className="page-header compact">
          <div className="favorites-filter-nav">
            {DASHBOARD_CATEGORIES.map(item => (
              <Button
                key={item.key}
                type={category === item.key ? 'primary' : 'default'}
                onClick={() => navigate(`/runtime/${item.key}`)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div>
            <h2 className="page-title">{getCategoryLabel(category)}</h2>
          </div>
        </div>
        {categoryDashboards.length > 0
          ? runtimeCards
          : <div className="panel-card canvas-card canvas-empty"><Empty description="当前分类下暂无已发布看板" /></div>}
      </div>
    );
  }

  if (!dashboard) {
    return <Spin />;
  }

  const currentDashboardFavorited = favoritedDashboardCodes.includes(dashboard.dashboardCode);

  return (
    <div className="page-shell runtime">
      <div>
        <div className="page-header compact">
          <Space wrap>
            <div className="favorites-filter-nav">
              {DASHBOARD_CATEGORIES.map(item => (
                <Button
                  key={item.key}
                  type={category === item.key ? 'primary' : 'default'}
                  onClick={() => navigate(`/runtime/${item.key}`)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <Select
              style={{ minWidth: 260 }}
              value={dashboard.dashboardCode}
              options={categoryDashboards.map(item => ({
                label: normalizeDisplayText(item.name, item.dashboardCode),
                value: item.dashboardCode
              }))}
              onChange={value => navigate(`/runtime/${category}/${value}`)}
            />
            <Button onClick={() => navigate(`/runtime/${category}`)}>返回看板预览</Button>
            <Button
              type={currentDashboardFavorited ? 'primary' : 'default'}
              icon={currentDashboardFavorited ? <StarFilled /> : <StarOutlined />}
              onClick={() => collectWholeBoard(dashboard)}
            >
              {currentDashboardFavorited ? '已收藏整个看板' : '收藏整个看板'}
            </Button>
          </Space>
          <div>
            <h2 className="page-title">{normalizeDisplayText(dashboard.name, dashboard.dashboardCode)}</h2>
          </div>
        </div>

        <DashboardCanvas
          components={dashboard.components}
          previews={previews}
          editable={false}
          onSelect={() => undefined}
          onLayoutChange={() => undefined}
          renderActions={component => {
            const favored = favoriteCodes.includes(component.componentCode);
            return (
              <Button
                size="small"
                type={favored ? 'primary' : 'default'}
                icon={favored ? <StarFilled /> : <StarOutlined />}
                onClick={() => {
                  if (favored) {
                    removeComponentFromAllBoards(component.componentCode);
                    setFavoriteCodes(state => state.filter(code => code !== component.componentCode));
                    message.success('已从个人指标库移除');
                    return;
                  }
                  setCollectingComponentCode(component.componentCode);
                  setSelectedBoardIds([]);
                  setShowCreateBoard(false);
                  setNewPrimaryLabel(getCategoryLabel(category));
                  setNewSecondaryLabel(normalizeDisplayText(dashboard.name, dashboard.dashboardCode));
                }}
              >
                {favored ? '已收藏' : '收藏图表'}
              </Button>
            );
          }}
        />
      </div>

      <Modal
        title="加入个人指标库"
        open={Boolean(collectingComponent)}
        okText="确认"
        cancelText="取消"
        onCancel={resetCollectModal}
        onOk={() => {
          if (!collectingComponent || !dashboard) return;
          const nextBoardIds = [...selectedBoardIds];
          if (showCreateBoard) {
            if (!newPrimaryLabel.trim() || !newSecondaryLabel.trim()) {
              message.warning('请先填写新看板的一级标签和二级标签');
              return;
            }
            const createdBoard = createPersonalBoard(newSecondaryLabel.trim(), {
              primaryLabel: newPrimaryLabel.trim(),
              secondaryLabel: newSecondaryLabel.trim()
            });
            nextBoardIds.push(createdBoard.boardId);
          }
          if (nextBoardIds.length === 0) {
            message.warning('请至少选择一个已有看板，或先新建看板');
            return;
          }
          [...new Set(nextBoardIds)].forEach(boardId => {
            addComponentToBoard(boardId, dashboard.dashboardCode, dashboard.name, collectingComponent);
          });
          setFavoriteCodes(state => [...new Set([...state, collectingComponent.componentCode])]);
          resetCollectModal();
          message.success('图表已加入个人指标库');
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Select
            mode="multiple"
            style={{ width: '100%' }}
            placeholder="选择一个或多个个人指标看板"
            value={selectedBoardIds}
            options={boards.map(board => ({
              label: `${board.primaryLabel || '未分组'} / ${board.secondaryLabel || board.boardName}`,
              value: board.boardId
            }))}
            onChange={value => setSelectedBoardIds(value)}
          />
          <Button block onClick={() => setShowCreateBoard(state => !state)}>
            {showCreateBoard ? '取消新建看板' : '新建看板'}
          </Button>
          {showCreateBoard ? (
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Input style={{ width: '100%' }} placeholder="一级标签" value={newPrimaryLabel} onChange={event => setNewPrimaryLabel(event.target.value)} />
              <Input style={{ width: '100%' }} placeholder="二级标签 / 看板名称" value={newSecondaryLabel} onChange={event => setNewSecondaryLabel(event.target.value)} />
            </Space>
          ) : null}
        </Space>
      </Modal>
    </div>
  );
}
