import {
  AppstoreOutlined,
  BankOutlined,
  ClusterOutlined,
  LineChartOutlined,
  MenuFoldOutlined,
  StarOutlined
} from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api/client';
import ExternalResourceConfigPage from './pages/ExternalResourceConfigPage';
import ExternalResourceGroupConfigPage from './pages/ExternalResourceGroupConfigPage';
import ExternalResourcePage from './pages/ExternalResourcePage';
import IndicatorCenterPage from './pages/IndicatorCenterPage';
import IndicatorConfigPage from './pages/IndicatorConfigPage';
import MyIndicatorsPage from './pages/MyIndicatorsPage';
import MyStrategy from './pages/MyStrategy';
import StrategyCenter from './pages/StrategyCenter';
import StrategyConfig from './pages/StrategyConfig';
import type { ExternalResourceGroup } from './types/dashboard';
import {
  syncDashboardCategoriesFromServer,
  syncDashboardMetaFromServer,
  useDashboardCategories
} from './utils/dashboardCatalog';
import { syncFavoritesFromServer } from './utils/favorites';
import { syncStrategiesFromServer } from './utils/strategies';

const TEXT = {
  myFavorites: '我的指标',
  myStrategy: '我的策略',
  strategyCenter: '策略中心',
  runtimeCenter: '指标中心',
  strategyConfig: '策略配置',
  externalResourceCenter: '友情链接',
  externalResourceConfig: '链接配置',
  designer: '指标配置',
  brand: '策略工作台'
};

function renderMenuIcon(Icon: typeof StarOutlined, color: string) {
  return <Icon style={{ color, fontSize: 18 }} />;
}

function resolveSelectedKey(pathname: string, categoryKeys: string[]) {
  if (pathname.startsWith('/runtime/')) {
    const [, , categoryKey] = pathname.split('/');
    if (categoryKey === 'all') {
      return 'runtime-group';
    }
    return categoryKeys.includes(categoryKey)
      ? `/runtime/${categoryKey}`
      : '/runtime/valuation';
  }
  if (pathname.startsWith('/favorites')) {
    return '/favorites';
  }
  if (pathname.startsWith('/strategy/config')) {
    return '/strategy/config';
  }
  if (pathname.startsWith('/external-resource-config')) {
    return '/external-resource-config';
  }
  if (pathname.startsWith('/external-resource/')) {
    const [, , slug] = pathname.split('/');
    return slug ? `/external-resource/${slug}` : '/external-resource-config';
  }
  if (pathname.startsWith('/strategy-center')) {
    return '/strategy-center';
  }
  if (pathname.startsWith('/my-strategy')) {
    return '/my-strategy';
  }
  return '/favorites';
}

export default function App() {
  const location = useLocation();
  const [, setSyncVersion] = useState(0);
  const [sharedReady, setSharedReady] = useState(false);
  const [externalResourceGroups, setExternalResourceGroups] = useState<ExternalResourceGroup[]>([]);
  const categories = useDashboardCategories();
  const selectedKey = resolveSelectedKey(location.pathname, categories.map(item => item.key));
  const runtimeCategories = categories;

  const externalMenuItems = useMemo(
    () => externalResourceGroups
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(item => ({
        key: `/external-resource/${item.slug}`,
        label: <Link to={`/external-resource/${item.slug}`}>{item.name}</Link>
      })),
    [externalResourceGroups]
  );

  const items = [
    {
      key: '/favorites',
      icon: renderMenuIcon(StarOutlined, '#eab308'),
      label: <Link to="/favorites">{TEXT.myFavorites}</Link>
    },
    {
      key: '/my-strategy',
      icon: renderMenuIcon(StarOutlined, '#eab308'),
      label: <Link to="/my-strategy">{TEXT.myStrategy}</Link>
    },
    {
      key: 'runtime-group',
      icon: renderMenuIcon(ClusterOutlined, '#2563eb'),
      label: TEXT.runtimeCenter,
      children: runtimeCategories.map(item => ({
        key: `/runtime/${item.key}`,
        label: <Link to={`/runtime/${item.key}`}>{item.label}</Link>
      }))
    },
    {
      key: '/strategy-center',
      icon: renderMenuIcon(ClusterOutlined, '#2563eb'),
      label: <Link to="/strategy-center">{TEXT.strategyCenter}</Link>
    },
    {
      key: 'external-resource-group',
      icon: renderMenuIcon(BankOutlined, '#b45309'),
      label: TEXT.externalResourceCenter,
      children: externalMenuItems
    },
    {
      key: '/designer',
      icon: renderMenuIcon(AppstoreOutlined, '#7c3aed'),
      label: <Link to="/designer">{TEXT.designer}</Link>
    },
    {
      key: '/strategy/config',
      icon: renderMenuIcon(AppstoreOutlined, '#7c3aed'),
      label: <Link to="/strategy/config">{TEXT.strategyConfig}</Link>
    },
    {
      key: '/external-resource-config',
      icon: renderMenuIcon(AppstoreOutlined, '#7c3aed'),
      label: <Link to="/external-resource-config">{TEXT.externalResourceConfig}</Link>
    }
  ];

  useEffect(() => {
    let cancelled = false;

    const syncSharedState = async () => {
      await Promise.all([
        syncDashboardCategoriesFromServer(),
        syncDashboardMetaFromServer(),
        syncFavoritesFromServer(),
        syncStrategiesFromServer('public'),
        syncStrategiesFromServer('personal')
      ]);
      const groups = await api.listExternalResourceGroups().catch(() => [] as ExternalResourceGroup[]);
      if (!cancelled) {
        setExternalResourceGroups(groups);
        setSharedReady(true);
        setSyncVersion(value => value + 1);
      }
    };

    void syncSharedState();
    const timer = window.setInterval(() => {
      void syncSharedState();
    }, 5000);
    const handleFocus = () => {
      void syncSharedState();
    };
    const handleExternalResourceChanged = () => {
      void syncSharedState();
    };
    window.addEventListener('focus', handleFocus);
    window.addEventListener('external-resource-groups-changed', handleExternalResourceChanged as EventListener);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('external-resource-groups-changed', handleExternalResourceChanged as EventListener);
    };
  }, []);

  if (!sharedReady) {
    return (
      <Layout className="app-shell app-shell-sidebar">
        <Layout.Content className="app-content app-content-sidebar">
          <div className="panel-card canvas-card canvas-empty">正在同步共享配置...</div>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout className="app-shell app-shell-sidebar">
      <aside
        className="app-sidebar"
        onMouseEnter={event => event.currentTarget.classList.add('expanded')}
        onMouseLeave={event => event.currentTarget.classList.remove('expanded')}
      >
        <div className="app-sidebar-brand">
          <LineChartOutlined />
          <span className="app-sidebar-brand-text">{TEXT.brand}</span>
          <MenuFoldOutlined className="app-sidebar-fold" />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['runtime-group', 'external-resource-group']}
          items={items}
          className="app-sidebar-menu"
        />
      </aside>
      <Layout.Content className="app-content app-content-sidebar">
        <Routes>
          <Route path="/" element={<Navigate to="/favorites" replace />} />
          <Route path="/designer" element={<IndicatorConfigPage />} />
          <Route path="/designer/:categoryKey" element={<IndicatorConfigPage />} />
          <Route path="/designer/:categoryKey/:chartCode" element={<IndicatorConfigPage />} />
          <Route path="/runtime" element={<IndicatorCenterPage />} />
          <Route path="/runtime/:categoryKey" element={<IndicatorCenterPage />} />
          <Route path="/runtime/:categoryKey/:chartCode" element={<IndicatorCenterPage />} />
          <Route path="/favorites" element={<MyIndicatorsPage />} />
          <Route path="/favorites/:chartId" element={<MyIndicatorsPage />} />
          <Route path="/my-strategy" element={<MyStrategy />} />
          <Route path="/my-strategy/:strategyId" element={<MyStrategy />} />
          <Route path="/strategy-center" element={<StrategyCenter />} />
          <Route path="/strategy-center/:strategyId" element={<StrategyCenter />} />
          <Route path="/strategy/config" element={<StrategyConfig />} />
          <Route path="/external-resource-config" element={<ExternalResourceConfigPage />} />
          <Route path="/external-resource-config/:groupId" element={<ExternalResourceGroupConfigPage />} />
          <Route path="/external-resource/:groupSlug" element={<ExternalResourcePage />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}
