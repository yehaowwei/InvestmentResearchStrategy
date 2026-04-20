import { BarChartOutlined, FolderOpenOutlined, FundProjectionScreenOutlined, MenuFoldOutlined, StarOutlined } from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import DashboardDesigner from './pages/DashboardDesigner';
import PersonalDashboard from './pages/PersonalDashboard';
import DashboardRuntime from './pages/DashboardRuntime';
import { DASHBOARD_CATEGORIES } from './utils/dashboardCatalog';

const items = [
  {
    key: '/designer',
    icon: <FundProjectionScreenOutlined />,
    label: <Link to="/designer">指标配置</Link>
  },
  {
    key: 'runtime-group',
    icon: <FolderOpenOutlined />,
    label: '公共指标库',
    children: DASHBOARD_CATEGORIES.map(item => ({
      key: `/runtime/${item.key}`,
      label: <Link to={`/runtime/${item.key}`}>{item.label}</Link>
    }))
  },
  {
    key: '/favorites',
    icon: <StarOutlined />,
    label: <Link to="/favorites">个人指标库</Link>
  }
];

function resolveSelectedKey(pathname: string) {
  if (pathname.startsWith('/runtime/')) {
    const [, , categoryKey] = pathname.split('/');
    return DASHBOARD_CATEGORIES.some(item => item.key === categoryKey) ? `/runtime/${categoryKey}` : '/runtime/valuation';
  }
  if (pathname.startsWith('/favorites')) {
    return '/favorites';
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
          <Route path="/designer/:categoryKey/:dashboardCode" element={<DashboardDesigner />} />
          <Route path="/runtime" element={<DashboardRuntime />} />
          <Route path="/runtime/:categoryKey" element={<DashboardRuntime />} />
          <Route path="/runtime/:categoryKey/:dashboardCode" element={<DashboardRuntime />} />
          <Route path="/favorites" element={<PersonalDashboard />} />
          <Route path="/favorites/:boardId" element={<PersonalDashboard />} />
        </Routes>
      </Layout.Content>
    </Layout>
  );
}
