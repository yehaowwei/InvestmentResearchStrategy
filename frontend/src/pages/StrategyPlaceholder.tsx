import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

function resolvePageContent(pathname: string) {
  if (pathname.startsWith('/strategy/config')) {
    return {
      title: '配置策略',
      description: '配置策略模块正在开发中，后续将在这里提供策略参数配置、版本管理和联动预览能力。'
    };
  }
  if (pathname.startsWith('/strategy/timing')) {
    return {
      title: '择时策略',
      description: '择时策略模块正在开发中，后续将在这里支持信号定义、回测分析和策略观察。'
    };
  }
  if (pathname.startsWith('/strategy/multi-asset')) {
    return {
      title: '多元细分品种策略',
      description: '多元细分品种策略模块正在开发中，后续将在这里支持分品种策略编排、比较和组合展示。'
    };
  }
  return {
    title: '我的策略',
    description: '我的策略模块正在开发中，后续将在这里集中查看、管理和追踪个人策略。'
  };
}

export default function StrategyPlaceholder() {
  const location = useLocation();
  const page = useMemo(() => resolvePageContent(location.pathname), [location.pathname]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{page.title}</h2>
          <div className="page-subtitle">{page.description}</div>
        </div>
      </div>

      <div className="panel-card canvas-card canvas-empty">
        <div className="single-chart-empty">
          <div className="single-chart-empty-title">{page.title}</div>
          <div className="page-subtitle">正在开发中，敬请期待。</div>
        </div>
      </div>
    </div>
  );
}
