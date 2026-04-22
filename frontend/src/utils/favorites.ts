import type { ComponentDslConfig, DashboardCategoryKey, DashboardComponent, DashboardDraft, FavoriteChart, PersonalBoard } from '../types/dashboard';
import { deepClone, normalizeDisplayText, normalizeDslConfig } from './dashboard';
import { getCategoryLabel } from './dashboardCatalog';

const LEGACY_STORAGE_KEY = 'bi-dashboard-favorites';
const BOARD_STORAGE_KEY = 'bi-dashboard-personal-boards';
const CHANGE_EVENT = 'bi-dashboard-favorites-changed';

export interface PersonalChartEntry {
  boardId: string;
  boardName: string;
  primaryLabel: string;
  secondaryLabel: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  chart: FavoriteChart;
}

function normalizeFavorite(item: FavoriteChart): FavoriteChart {
  return {
    ...item,
    dashboardName: normalizeDisplayText(item.dashboardName, item.dashboardCode),
    componentTitle: normalizeDisplayText(item.componentTitle, item.componentCode),
    dslConfig: normalizeDslConfig(item.dslConfig as ComponentDslConfig)
  };
}

function normalizeBoard(board: PersonalBoard, fallbackOrder = 0): PersonalBoard {
  const secondaryLabel = normalizeDisplayText(board.secondaryLabel || board.boardName, board.boardId);
  return {
    ...board,
    boardName: secondaryLabel,
    primaryLabel: normalizeDisplayText(board.primaryLabel, '未分组'),
    secondaryLabel,
    order: Number.isFinite(board.order) ? board.order : fallbackOrder,
    components: Array.isArray(board.components) ? board.components.map(normalizeFavorite) : []
  };
}

function readLegacyFavorites(): FavoriteChart[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as FavoriteChart[];
    return Array.isArray(parsed) ? parsed.map(normalizeFavorite) : [];
  } catch {
    return [];
  }
}

function writeBoards(boards: PersonalBoard[]) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(BOARD_STORAGE_KEY, JSON.stringify(boards));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function readBoards(): PersonalBoard[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(BOARD_STORAGE_KEY);
    if (!raw) {
      const legacyFavorites = readLegacyFavorites();
      if (legacyFavorites.length === 0) {
        return [];
      }
      const migratedBoards = legacyFavorites.map((favorite, index) => ({
        boardId: `favorite-${favorite.favoriteId}`,
        boardName: favorite.componentTitle,
        primaryLabel: '未分组',
        secondaryLabel: favorite.componentTitle,
        order: index + 1,
        createdAt: favorite.addedAt,
        updatedAt: favorite.addedAt,
        components: [favorite]
      }));
      writeBoards(migratedBoards);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migratedBoards;
    }

    const parsed = JSON.parse(raw) as PersonalBoard[];
    return Array.isArray(parsed)
      ? parsed.map((board, index) => normalizeBoard(board, index + 1))
      : [];
  } catch {
    return [];
  }
}

function toFavoriteChart(dashboardCode: string, dashboardName: string, component: DashboardComponent): FavoriteChart {
  return {
    favoriteId: `${dashboardCode}:${component.componentCode}`,
    dashboardCode,
    dashboardName: normalizeDisplayText(dashboardName, dashboardCode),
    componentCode: component.componentCode,
    componentTitle: normalizeDisplayText(component.dslConfig.visualDsl.title || component.title, component.componentCode),
    templateCode: component.templateCode,
    modelCode: component.modelCode,
    dslConfig: normalizeDslConfig(deepClone(component.dslConfig)),
    addedAt: new Date().toISOString()
  };
}

function sortBoards(boards: PersonalBoard[]) {
  return [...boards].sort((a, b) => {
    if (a.order !== b.order) {
      return a.order - b.order;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function listPersonalBoards() {
  return sortBoards(readBoards());
}

export function listPersonalCharts(): PersonalChartEntry[] {
  return listPersonalBoards()
    .flatMap(board => board.components.map(chart => ({
      boardId: board.boardId,
      boardName: board.boardName,
      primaryLabel: board.primaryLabel || '未分组',
      secondaryLabel: board.secondaryLabel || board.boardName,
      order: board.order,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      chart
    })));
}

export function reorderPersonalCharts(chartIdsInOrder: string[]) {
  const orderMap = new Map(chartIdsInOrder.map((id, index) => [id, index + 1]));
  const boards = readBoards().map(board => ({
    ...board,
    order: orderMap.get(board.boardId) ?? board.order,
    updatedAt: new Date().toISOString()
  }));
  writeBoards(sortBoards(boards));
}

export function getPersonalChart(chartId?: string) {
  if (!chartId) return undefined;
  return listPersonalCharts().find(item => item.boardId === chartId || item.chart.favoriteId === chartId || item.chart.componentCode === chartId);
}

export function getPersonalBoard(boardId?: string) {
  if (!boardId) return undefined;
  return readBoards().find(item => item.boardId === boardId);
}

export function updatePersonalChart(chartId: string, patch: Partial<Pick<PersonalChartEntry, 'primaryLabel' | 'secondaryLabel' | 'order'>>) {
  const boards = readBoards().map(board => (
    board.boardId === chartId
      ? {
        ...board,
        boardName: normalizeDisplayText(patch.secondaryLabel || board.boardName, board.boardId),
        primaryLabel: normalizeDisplayText(patch.primaryLabel ?? board.primaryLabel, '未分组'),
        secondaryLabel: normalizeDisplayText(patch.secondaryLabel || board.secondaryLabel || board.boardName, board.boardId),
        order: patch.order ?? board.order,
        updatedAt: new Date().toISOString()
      }
      : board
  ));
  writeBoards(sortBoards(boards));
}

export function createFavoriteFromComponent(
  dashboardCode: string,
  dashboardName: string,
  component: DashboardComponent,
  options?: { primaryLabel?: string; secondaryLabel?: string }
) {
  const boards = readBoards();
  const favorite = toFavoriteChart(dashboardCode, dashboardName, component);
  const existing = boards.find(board => board.components.some(item => item.favoriteId === favorite.favoriteId));
  if (existing) {
    return existing;
  }

  const secondaryLabel = normalizeDisplayText(options?.secondaryLabel || favorite.componentTitle, favorite.componentCode);
  const nextBoard: PersonalBoard = {
    boardId: `favorite-${favorite.favoriteId}`,
    boardName: secondaryLabel,
    primaryLabel: normalizeDisplayText(options?.primaryLabel, '未分组'),
    secondaryLabel,
    order: boards.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    components: [favorite]
  };
  boards.push(nextBoard);
  writeBoards(sortBoards(boards));
  return nextBoard;
}

export function createBoardFromDashboard(dashboard: DashboardDraft, category?: DashboardCategoryKey) {
  if (!dashboard.components[0]) {
    return undefined;
  }
  return createFavoriteFromComponent(
    dashboard.dashboardCode,
    dashboard.name,
    dashboard.components[0],
    {
      primaryLabel: category ? getCategoryLabel(category) : '未分组',
      secondaryLabel: normalizeDisplayText(dashboard.components[0].dslConfig.visualDsl.title || dashboard.components[0].title, dashboard.dashboardCode)
    }
  );
}

export function createPersonalBoard(boardName: string, options?: { primaryLabel?: string; secondaryLabel?: string }) {
  const boards = readBoards();
  const secondaryLabel = normalizeDisplayText(options?.secondaryLabel || boardName, boardName);
  const nextBoard: PersonalBoard = {
    boardId: `board-${Date.now()}`,
    boardName: secondaryLabel,
    primaryLabel: normalizeDisplayText(options?.primaryLabel, '未分组'),
    secondaryLabel,
    order: boards.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    components: []
  };
  boards.push(nextBoard);
  writeBoards(sortBoards(boards));
  return nextBoard;
}

export function isDashboardFavorited(dashboard: DashboardDraft) {
  return dashboard.components.some(component => isFavorite(component.componentCode));
}

export function updatePersonalBoard(boardId: string, patch: Partial<Pick<PersonalBoard, 'boardName' | 'primaryLabel' | 'secondaryLabel' | 'order'>>) {
  updatePersonalChart(boardId, patch);
}

export function deletePersonalBoard(boardId: string) {
  writeBoards(sortBoards(readBoards().filter(board => board.boardId !== boardId)));
}

export function addComponentToBoard(boardId: string, dashboardCode: string, dashboardName: string, component: DashboardComponent) {
  const nextFavorite = toFavoriteChart(dashboardCode, dashboardName, component);
  const boards = readBoards().map(board => {
    if (board.boardId !== boardId) return board;
    return {
      ...board,
      updatedAt: new Date().toISOString(),
      boardName: nextFavorite.componentTitle,
      secondaryLabel: nextFavorite.componentTitle,
      components: [nextFavorite]
    };
  });
  writeBoards(sortBoards(boards));
}

export function removeComponentFromBoard(boardId: string, componentCode: string) {
  writeBoards(sortBoards(readBoards().filter(board => !(board.boardId === boardId && board.components.some(item => item.componentCode === componentCode)))));
}

export function removeComponentFromAllBoards(componentCode: string) {
  writeBoards(sortBoards(readBoards().filter(board => !board.components.some(item => item.componentCode === componentCode))));
}

export function isFavorite(componentCode: string) {
  return readBoards().some(board => board.components.some(item => item.componentCode === componentCode));
}

export function saveFavoriteLayouts(boardId: string, components: DashboardComponent[]) {
  const component = components[0];
  if (!component) {
    return;
  }
  const boards = readBoards().map(board => {
    if (board.boardId !== boardId) {
      return board;
    }
    const existing = board.components[0];
    if (!existing) {
      return board;
    }
    const nextTitle = normalizeDisplayText(component.dslConfig.visualDsl.title || component.title, component.componentCode);
    return {
      ...board,
      boardName: nextTitle,
      secondaryLabel: nextTitle,
      updatedAt: new Date().toISOString(),
      components: [{
        ...existing,
        componentTitle: nextTitle,
        dslConfig: normalizeDslConfig(deepClone(component.dslConfig))
      }]
    };
  });
  writeBoards(sortBoards(boards));
}
