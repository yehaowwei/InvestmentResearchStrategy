import { BarChartOutlined, FileTextOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Spin } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import AppSearchInput from '../components/AppSearchInput';
import type { ExternalResourceGroup } from '../types/dashboard';
import { scrollContainerItemToCenter } from './indicatorPageNavigation';

function formatUpdatedAt(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return '';
  }
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveResourceType(fileName: string) {
  return fileName.toLowerCase().endsWith('.html') ? 'HTML' : '资源';
}

export default function ExternalResourcePage() {
  const params = useParams();
  const groupSlug = params.groupSlug ?? '';
  const [group, setGroup] = useState<ExternalResourceGroup>();
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);

    api.getExternalResourceGroupBySlug(groupSlug)
      .then(nextGroup => {
        if (!cancelled) {
          setGroup(nextGroup);
        }
      })
      .catch(loadError => {
        if (!cancelled) {
          console.error(loadError);
          setError(loadError instanceof Error ? loadError.message : '外部资源加载失败');
          setGroup(undefined);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [groupSlug]);

  const filteredFiles = (group?.files ?? []).filter(item => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return true;
    }
    return item.title.toLowerCase().includes(normalizedKeyword)
      || item.fileName.toLowerCase().includes(normalizedKeyword);
  });

  useEffect(() => {
    if (!tocScrollRef.current || filteredFiles.length === 0) {
      return;
    }
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${filteredFiles[0].fileId}"]`);
  }, [filteredFiles]);

  const openFile = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  if (error) {
    return <Alert type="error" showIcon message="外部资源加载失败" description={error} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{group?.name ?? '外部资源'}</h2>
          <div className="page-subtitle">{group?.description || '按资源名称直接跳转到对应 HTML 页面。'}</div>
        </div>
      </div>

      <div className="favorites-filter-nav">
        <AppSearchInput
          allowClear
          placeholder="搜索资源名称"
          className="page-toc-width-search"
          style={{ marginLeft: 'auto' }}
          value={keyword}
          onChange={event => setKeyword(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="panel-card canvas-card canvas-empty">
          <Spin tip="外部资源加载中" />
        </div>
      ) : (
        <div className="page-shell runtime-library-shell">
          <div>
            {filteredFiles.length > 0 ? (
              <div className="convertible-board-grid">
                {filteredFiles.map(item => (
                  <article
                    key={item.fileId}
                    className="panel-card convertible-board-card"
                    onClick={() => openFile(item.href)}
                  >
                    <div className="convertible-board-card-head">
                      <div className="convertible-board-badge">
                        <FileTextOutlined />
                        <span>{resolveResourceType(item.fileName)}</span>
                      </div>
                    </div>
                    <div className="convertible-board-card-body">
                      <div className="convertible-board-card-title-row">
                        <h3 className="convertible-board-card-title">{item.title}</h3>
                        <BarChartOutlined className="convertible-board-card-title-icon" />
                      </div>
                    </div>
                    <div className="convertible-board-card-foot">
                      <Button
                        type="default"
                        className="convertible-board-open-button"
                        onClick={event => {
                          event.stopPropagation();
                          openFile(item.href);
                        }}
                      >
                        查看
                      </Button>
                      <span className="convertible-board-date">{formatUpdatedAt(item.updatedAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="panel-card canvas-card canvas-empty">
                <Empty description="当前目录下还没有 HTML 资源" />
              </div>
            )}
          </div>

          <aside className="panel-card runtime-toc-card">
            <div className="runtime-toc-title">资源导航</div>
            <div className="runtime-toc-scroll" ref={tocScrollRef}>
              <div className="runtime-toc-items">
                {filteredFiles.map(item => (
                  <button
                    key={item.fileId}
                    type="button"
                    data-chart-code={item.fileId}
                    className="runtime-toc-item active"
                    onClick={() => openFile(item.href)}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
