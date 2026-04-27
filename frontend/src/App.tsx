import {
  AppstoreOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  FolderViewOutlined,
  LineChartOutlined,
  OrderedListOutlined,
  MenuFoldOutlined,
  StarOutlined
} from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import DashboardDesigner from './pages/DashboardDesigner';
import PersonalDashboard from './pages/PersonalDashboard';
import DashboardRuntime from './pages/DashboardRuntime';
import MyStrategy from './pages/MyStrategy';
import StrategyCenter from './pages/StrategyCenter';
import StrategyConfig from './pages/StrategyConfig';
import { DASHBOARD_CATEGORIES, syncDashboardMetaFromServer } from './utils/dashboardCatalog';
import { syncFavoritesFromServer } from './utils/favorites';
import { syncStrategiesFromServer } from './utils/strategies';

const TEXT = {
  myFavorites: '\u6211\u7684\u6307\u6807',
  myStrategy: '\u6211\u7684\u7b56\u7565',
  strategyCenter: '\u7b56\u7565\u4e2d\u5fc3',
  runtimeCenter: '\u6307\u6807\u4e2d\u5fc3',
  strategyConfig: '\u7b56\u7565\u914d\u7f6e',
  designer: '\u6307\u6807\u914d\u7f6e',
  brand: '\u6295\u7814\u7b56\u7565\u5316\u5e73\u53f0'
};

const items = [
  {
    key: '/favorites',
    icon: <StarOutlined />,
    label: <Link to="/favorites">{TEXT.myFavorites}</Link>
  },
  {
    key: '/my-strategy',
    icon: <FolderViewOutlined />,
    label: <Link to="/my-strategy">{TEXT.myStrategy}</Link>
  },
  {
    key: 'runtime-group',
    icon: <DatabaseOutlined />,
    label: TEXT.runtimeCenter,
    children: DASHBOARD_CATEGORIES.map(item => ({
      key: `/runtime/${item.key}`,
      label: <Link to={`/runtime/${item.key}`}>{item.label}</Link>
    }))
  },
  {
    key: '/strategy-center',
    icon: <ClusterOutlined />,
    label: <Link to="/strategy-center">{TEXT.strategyCenter}</Link>
  },
  {
    key: '/designer',
    icon: <AppstoreOutlined />,
    label: <Link to="/designer">{TEXT.designer}</Link>
  },
  {
    key: '/strategy/config',
    icon: <OrderedListOutlined />,
    label: <Link to="/strategy/config">{TEXT.strategyConfig}</Link>
  }
];

function resolveSelectedKey(pathname: string) {
  if (pathname.startsWith('/runtime/')) {
    const [, , categoryKey] = pathname.split('/');
    if (categoryKey === 'all') {
      return 'runtime-group';
    }
    return DASHBOARD_CATEGORIES.some(item => item.key === categoryKey)
      ? `/runtime/${categoryKey}`
      : '/runtime/valuation';
  }
  if (pathname.startsWith('/favorites')) {
    return '/favorites';
  }
  if (pathname.startsWith('/strategy/config')) {
    return '/strategy/config';
  }
  if (pathname.startsWith('/strategy-center')) {
    return '/strategy-center';
  }
  if (pathname.startsWith('/my-strategy')) {
    return '/my-strategy';
  }
  return '/designer';
}

export default function App() {
  const location = useLocation();
  const [, setSyncVersion] = useState(0);
  const [sharedReady, setSharedReady] = useState(false);
  const selectedKey = resolveSelectedKey(location.pathname);

  useEffect(() => {
    let cancelled = false;

    const syncSharedState = async () => {
      await Promise.all([
        syncDashboardMetaFromServer(),
        syncFavoritesFromServer(),
        syncStrategiesFromServer('public'),
        syncStrategiesFromServer('personal')
      ]);
      if (!cancelled) {
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
    window.addEventListener('focus', handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
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
          defaultOpenKeys={['runtime-group']}
          items={items}
          className="app-sidebar-menu"
        />
      </aside>
      <Layout.Content className="app-content app-content-sidebar">
        <Routes>
          <Route path="/" element={<DashboardDesigner />} />
          <Route path="/designer" element={<DashboardDesigner />} />
          <Route path="/designer/:categoryKey" element={<DashboardDesigner />} />
          <Route path="/designer/:categoryKey/:chartCode" element={<DashboardDesigner />} />
          <Route path="/runtime" element={<DashboardRuntime />} />
          <Route path="/runtime/:categoryKey" element={<DashboardRuntime />} />
          <Route path="/runtime/:categoryKey/:chartCode" element={<DashboardRuntime />} />
          <Route path="/favorites" element={<PersonalDashboard />} />
          <Route path="/favorites/:chartId" element={<PersonalDashboard />} />
          <Route path="/my-strategy" element={<MyStrategy />} />
          <Route path="/my-strategy/:strategyId" element={<MyStrategy />} />
          <Route path="/strategy-center" element={<StrategyCenter />} />
          <Route path="/strategy-center/:strategyId" element={<StrategyCenter />} />
          <Route path="/strategy/config" element={<StrategyConfig />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}
