import type { ComponentDslConfig, DashboardCategoryKey, DashboardComponent, DashboardDraft, FavoriteChart, PersonalBoard } from '../types/dashboard';
import { deepClone, normalizeDisplayText, normalizeDslConfig } from './dashboard';
import { getCategoryLabel } from './dashboardCatalog';

const LEGACY_STORAGE_KEY = 'bi-dashboard-favorites';
const BOARD_STORAGE_KEY = 'bi-dashboard-personal-boards';
const CHANGE_EVENT = 'bi-dashboard-favorites-changed';

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
      const migratedBoard: PersonalBoard = {
        boardId: 'default-board',
        boardName: '默认看板',
        primaryLabel: '未分组',
        secondaryLabel: '默认看板',
        order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        components: legacyFavorites
      };
      writeBoards([migratedBoard]);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return [migratedBoard];
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

function boardMatchesDashboard(board: PersonalBoard, dashboard: DashboardDraft) {
  if (board.components.length !== dashboard.components.length) {
    return false;
  }
  const dashboardComponentCodes = new Set(dashboard.components.map(component => component.componentCode));
  return board.components.length > 0
    && board.components.every(item => item.dashboardCode === dashboard.dashboardCode && dashboardComponentCodes.has(item.componentCode));
}

export function listPersonalBoards() {
  return sortBoards(readBoards());
}

export function getPersonalBoard(boardId?: string) {
  if (!boardId) return undefined;
  return readBoards().find(item => item.boardId === boardId);
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

export function createBoardFromDashboard(dashboard: DashboardDraft, category?: DashboardCategoryKey) {
  const boards = readBoards();
  const existingBoard = boards.find(board => boardMatchesDashboard(board, dashboard));
  if (existingBoard) {
    return existingBoard;
  }
  const secondaryLabel = normalizeDisplayText(dashboard.name, dashboard.dashboardCode);
  const nextBoard: PersonalBoard = {
    boardId: `board-${Date.now()}`,
    boardName: secondaryLabel,
    primaryLabel: category ? getCategoryLabel(category) : '未分组',
    secondaryLabel,
    order: boards.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    components: dashboard.components.map(component => toFavoriteChart(dashboard.dashboardCode, dashboard.name, component))
  };
  boards.push(nextBoard);
  writeBoards(sortBoards(boards));
  return nextBoard;
}

export function isDashboardFavorited(dashboard: DashboardDraft) {
  return readBoards().some(board => boardMatchesDashboard(board, dashboard));
}

export function updatePersonalBoard(boardId: string, patch: Partial<Pick<PersonalBoard, 'boardName' | 'primaryLabel' | 'secondaryLabel' | 'order'>>) {
  const boards = readBoards().map(board => (
    board.boardId === boardId
      ? {
          ...board,
          ...patch,
          boardName: normalizeDisplayText(patch.secondaryLabel || patch.boardName || board.boardName, board.boardId),
          primaryLabel: normalizeDisplayText(patch.primaryLabel ?? board.primaryLabel, '未分组'),
          secondaryLabel: normalizeDisplayText(patch.secondaryLabel || patch.boardName || board.secondaryLabel || board.boardName, board.boardId),
          order: patch.order ?? board.order,
          updatedAt: new Date().toISOString()
        }
      : board
  ));
  writeBoards(sortBoards(boards));
}

export function deletePersonalBoard(boardId: string) {
  writeBoards(sortBoards(readBoards().filter(board => board.boardId !== boardId)));
}

export function addComponentToBoard(boardId: string, dashboardCode: string, dashboardName: string, component: DashboardComponent) {
  const nextFavorite = toFavoriteChart(dashboardCode, dashboardName, component);
  const boards = readBoards().map(board => {
    if (board.boardId !== boardId) return board;
    const existingIndex = board.components.findIndex(item => item.componentCode === component.componentCode);
    const nextComponents = [...board.components];
    if (existingIndex >= 0) {
      nextComponents[existingIndex] = nextFavorite;
    } else {
      nextComponents.push(nextFavorite);
    }
    return {
      ...board,
      updatedAt: new Date().toISOString(),
      components: nextComponents
    };
  });
  writeBoards(sortBoards(boards));
}

export function removeComponentFromBoard(boardId: string, componentCode: string) {
  const boards = readBoards().map(board => (
    board.boardId === boardId
      ? {
          ...board,
          updatedAt: new Date().toISOString(),
          components: board.components.filter(item => item.componentCode !== componentCode)
        }
      : board
  ));
  writeBoards(sortBoards(boards));
}

export function removeComponentFromAllBoards(componentCode: string) {
  const boards = readBoards().map(board => ({
    ...board,
    updatedAt: new Date().toISOString(),
    components: board.components.filter(item => item.componentCode !== componentCode)
  }));
  writeBoards(sortBoards(boards));
}

export function isFavorite(componentCode: string) {
  return readBoards().some(board => board.components.some(item => item.componentCode === componentCode));
}

export function saveFavoriteLayouts(boardId: string, components: DashboardComponent[]) {
  const componentMap = new Map(components.map(component => [component.componentCode, component]));
  const boards = readBoards().map(board => {
    if (board.boardId !== boardId) {
      return board;
    }
    return {
      ...board,
      updatedAt: new Date().toISOString(),
      components: board.components.map(item => {
        const component = componentMap.get(item.componentCode);
        if (!component) {
          return item;
        }
        return {
          ...item,
          componentTitle: normalizeDisplayText(component.dslConfig.visualDsl.title || component.title, component.componentCode),
          dslConfig: normalizeDslConfig(deepClone(component.dslConfig))
        };
      })
    };
  });
  writeBoards(sortBoards(boards));
}
