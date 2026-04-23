import {
  BarChartOutlined,
  FolderOpenOutlined,
  FundProjectionScreenOutlined,
  MenuFoldOutlined,
  StarOutlined
} from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import DashboardDesigner from './pages/DashboardDesigner';
import PersonalDashboard from './pages/PersonalDashboard';
import DashboardRuntime from './pages/DashboardRuntime';
import StrategyPlaceholder from './pages/StrategyPlaceholder';
import { DASHBOARD_CATEGORIES } from './utils/dashboardCatalog';

const items = [
  {
    key: '/favorites',
    icon: <StarOutlined />,
    label: <Link to="/favorites">我的指标</Link>
  },
  {
    key: '/my-strategy',
    icon: <StarOutlined />,
    label: <Link to="/my-strategy">我的策略</Link>
  },
  {
    key: 'runtime-group',
    icon: <FolderOpenOutlined />,
    label: '指标中心',
    children: DASHBOARD_CATEGORIES.map(item => ({
      key: `/runtime/${item.key}`,
      label: <Link to={`/runtime/${item.key}`}>{item.label}</Link>
    }))
  },
  {
    key: 'strategy-group',
    icon: <BarChartOutlined />,
    label: '策略中心',
    children: [
      {
        key: '/strategy/config',
        label: <Link to="/strategy/config">配置策略</Link>
      },
      {
        key: '/strategy/timing',
        label: <Link to="/strategy/timing">择时策略</Link>
      },
      {
        key: '/strategy/multi-asset',
        label: <Link to="/strategy/multi-asset">多元细分品种策略</Link>
      }
    ]
  },
  {
    key: '/designer',
    icon: <FundProjectionScreenOutlined />,
    label: <Link to="/designer">指标配置</Link>
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
  if (pathname.startsWith('/strategy/timing')) {
    return '/strategy/timing';
  }
  if (pathname.startsWith('/strategy/multi-asset')) {
    return '/strategy/multi-asset';
  }
  if (pathname.startsWith('/my-strategy')) {
    return '/my-strategy';
  }
  return '/designer';
}

export default function App() {
  const location = useLocation();
  const selectedKey = resolveSelectedKey(location.pathname);

  return (
    <Layout className="app-shell app-shell-sidebar">
      <aside
        className="app-sidebar"
        onMouseEnter={event => event.currentTarget.classList.add('expanded')}
        onMouseLeave={event => event.currentTarget.classList.remove('expanded')}
      >
        <div className="app-sidebar-brand">
          <BarChartOutlined />
          <span className="app-sidebar-brand-text">投研策略化平台</span>
          <MenuFoldOutlined className="app-sidebar-fold" />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={['runtime-group', 'strategy-group']}
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
          <Route path="/strategy/config" element={<StrategyPlaceholder />} />
          <Route path="/strategy/timing" element={<StrategyPlaceholder />} />
          <Route path="/strategy/multi-asset" element={<StrategyPlaceholder />} />
          <Route path="/my-strategy" element={<StrategyPlaceholder />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}
