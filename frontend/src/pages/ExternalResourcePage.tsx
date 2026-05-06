import { FileTextOutlined, LinkOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Spin } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ExternalResourceFile, ExternalResourceGroup } from '../types/dashboard';
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

function resolveResourceType(file: ExternalResourceFile) {
  return file.resourceType === 'LINK' ? '链接' : 'HTML';
}

function resolveThirdLevel(file: ExternalResourceFile) {
  const normalized = file.thirdLevelName?.trim();
  return normalized && normalized.length > 0 ? normalized : '未配置三级目录';
}

function ExternalResourceWorkspace(props: { group?: ExternalResourceGroup; loading: boolean }) {
  const [activeFile, setActiveFile] = useState<ExternalResourceFile>();
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  const files = props.group?.files ?? [];
  const thirdLevelGroups = useMemo(() => {
    const grouped = new Map<string, ExternalResourceFile[]>();
    files.forEach(file => {
      const key = resolveThirdLevel(file);
      grouped.set(key, [...(grouped.get(key) ?? []), file]);
    });
    return Array.from(grouped.entries()).map(([label, items]) => ({ label, items }));
  }, [files]);

  useEffect(() => {
    setActiveFile(files[0]);
  }, [props.group?.groupId, files]);

  useEffect(() => {
    if (!activeFile && files.length > 0) {
      setActiveFile(files[0]);
    }
  }, [activeFile, files]);

  useEffect(() => {
    if (!tocScrollRef.current || !activeFile?.fileId) {
      return;
    }
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${activeFile.fileId}"]`);
  }, [activeFile]);

  const activeThirdLevel = activeFile ? resolveThirdLevel(activeFile) : undefined;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{props.group?.name ?? '外部资源'}</h2>
          <div className="page-subtitle">{props.group?.description || '选择右侧目录后，在本页容器中嵌入展示 HTML 或链接资源。'}</div>
        </div>
      </div>

      {thirdLevelGroups.length > 0 ? (
        <div className="favorites-filter-nav external-resource-tabs">
          {thirdLevelGroups.map(group => (
            <Button
              key={group.label}
              type={group.label === activeThirdLevel ? 'primary' : 'default'}
              onClick={() => setActiveFile(group.items[0])}
            >
              {group.label}
            </Button>
          ))}
        </div>
      ) : null}

      {props.loading ? (
        <div className="panel-card canvas-card canvas-empty">
          <Spin tip="外部资源加载中" />
        </div>
      ) : (
        <div className="page-shell runtime-library-shell">
          <section className="panel-card convertible-research-stage">
            {activeFile ? (
              <>
                <div className="convertible-research-stage-head">
                  <div>
                    <div className="convertible-research-stage-title">{activeFile.title}</div>
                    <div className="external-resource-stage-type">
                      {activeFile.resourceType === 'LINK' ? <LinkOutlined /> : <FileTextOutlined />}
                      <span>{resolveResourceType(activeFile)}</span>
                      <span>·</span>
                      <span>{resolveThirdLevel(activeFile)}</span>
                    </div>
                  </div>
                  <div className="convertible-research-stage-meta">{formatUpdatedAt(activeFile.updatedAt)}</div>
                </div>
                <iframe
                  key={activeFile.fileId}
                  title={activeFile.title}
                  src={activeFile.href}
                  className="convertible-research-frame"
                />
              </>
            ) : (
              <div className="convertible-research-empty">
                <Empty description="请选择右侧目录中的资源" />
              </div>
            )}
          </section>

          <aside className="panel-card runtime-toc-card">
            <div className="runtime-toc-title">{props.group?.name ?? '资源导航'}</div>
            <div className="runtime-toc-scroll" ref={tocScrollRef}>
              {thirdLevelGroups.map(group => (
                <div key={group.label} className="runtime-toc-group">
                  <button
                    type="button"
                    className={`runtime-toc-group-button${group.label === activeThirdLevel ? ' active' : ''}`}
                    onClick={() => setActiveFile(group.items[0])}
                  >
                    {group.label}
                  </button>
                  <div className="runtime-toc-items">
                    {group.items.map(item => (
                      <button
                        key={item.fileId}
                        type="button"
                        data-chart-code={item.fileId}
                        className={`runtime-toc-item${item.fileId === activeFile?.fileId ? ' active' : ''}`}
                        onClick={() => setActiveFile(item)}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {thirdLevelGroups.length === 0 ? <Empty description="当前目录还没有配置资源" /> : null}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function ExternalResourcePage() {
  const params = useParams();
  const groupSlug = params.groupSlug ?? '';
  const [group, setGroup] = useState<ExternalResourceGroup>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

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

  if (error) {
    return <Alert type="error" showIcon message="外部资源加载失败" description={error} />;
  }

  return <ExternalResourceWorkspace group={group} loading={loading} />;
}
