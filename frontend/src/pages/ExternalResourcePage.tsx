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

function ExternalResourceWorkspace(props: { group?: ExternalResourceGroup; loading: boolean }) {
  const [activeFile, setActiveFile] = useState<ExternalResourceFile>();
  const [activeThirdLevel, setActiveThirdLevel] = useState('');
  const tocScrollRef = useRef<HTMLDivElement | null>(null);

  const files = props.group?.files ?? [];
  const thirdLevelDirectories = props.group?.thirdLevelDirectories ?? [];
  const hasThirdLevelDirectories = thirdLevelDirectories.length > 0;
  const thirdLevelGroups = useMemo(
    () => thirdLevelDirectories.map(name => ({
      label: name,
      items: files.filter(file => file.thirdLevelName?.trim() === name)
    })),
    [files, thirdLevelDirectories]
  );

  useEffect(() => {
    if (hasThirdLevelDirectories) {
      const firstGroup = thirdLevelGroups.find(group => group.items.length > 0) ?? thirdLevelGroups[0];
      setActiveThirdLevel(firstGroup?.label ?? '');
      setActiveFile(firstGroup?.items[0]);
      return;
    }
    setActiveThirdLevel('');
    setActiveFile(files[0]);
  }, [props.group?.groupId, files, hasThirdLevelDirectories, thirdLevelGroups]);

  useEffect(() => {
    if (!hasThirdLevelDirectories || !tocScrollRef.current || !activeFile?.fileId) {
      return;
    }
    scrollContainerItemToCenter(tocScrollRef.current, `[data-chart-code="${activeFile.fileId}"]`);
  }, [activeFile, hasThirdLevelDirectories]);

  const activateThirdLevel = (label: string) => {
    const group = thirdLevelGroups.find(item => item.label === label);
    setActiveThirdLevel(label);
    setActiveFile(group?.items[0]);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{props.group?.name ?? '外部资源'}</h2>
        </div>
      </div>

      {hasThirdLevelDirectories ? (
        <div className="favorites-filter-nav external-resource-tabs">
          {thirdLevelGroups.map(group => (
            <Button
              key={group.label}
              type={group.label === activeThirdLevel ? 'primary' : 'default'}
              onClick={() => activateThirdLevel(group.label)}
            >
              {group.label}
            </Button>
          ))}
        </div>
      ) : files.length > 0 ? (
        <div className="favorites-filter-nav external-resource-tabs">
          {files.map(file => (
            <Button
              key={file.fileId}
              type={file.fileId === activeFile?.fileId ? 'primary' : 'default'}
              onClick={() => setActiveFile(file)}
            >
              {file.title}
            </Button>
          ))}
        </div>
      ) : null}

      {props.loading ? (
        <div className="panel-card canvas-card canvas-empty">
          <Spin tip="外部资源加载中" />
        </div>
      ) : (
        <div className={hasThirdLevelDirectories ? 'page-shell runtime-library-shell' : 'external-resource-single-shell'}>
          <section className="panel-card convertible-research-stage">
            {activeFile ? (
              <>
                <div className="convertible-research-stage-head">
                  <div>
                    <div className="convertible-research-stage-title">{activeFile.title}</div>
                    <div className="external-resource-stage-type">
                      {activeFile.resourceType === 'LINK' ? <LinkOutlined /> : <FileTextOutlined />}
                      <span>{resolveResourceType(activeFile)}</span>
                      {hasThirdLevelDirectories ? (
                        <>
                          <span>·</span>
                          <span>{activeThirdLevel}</span>
                        </>
                      ) : null}
                    </div>
                    {activeFile.resourceType === 'LINK' ? (
                      <a
                        className="external-resource-link-address"
                        href={activeFile.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {activeFile.href}
                      </a>
                    ) : null}
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
                <Empty description={hasThirdLevelDirectories ? '当前三级目录还没有资源' : '请选择资源'} />
              </div>
            )}
          </section>

          {hasThirdLevelDirectories ? (
            <aside className="panel-card runtime-toc-card">
              <div className="runtime-toc-title">{props.group?.name ?? '资源导航'}</div>
              <div className="runtime-toc-scroll" ref={tocScrollRef}>
                {thirdLevelGroups.map(group => (
                  <div key={group.label} className="runtime-toc-group">
                    <button
                      type="button"
                      className={`runtime-toc-group-button${group.label === activeThirdLevel ? ' active' : ''}`}
                      onClick={() => activateThirdLevel(group.label)}
                    >
                      {group.label}
                    </button>
                    <div className="runtime-toc-items">
                      {group.items.length > 0 ? group.items.map(item => (
                        <button
                          key={item.fileId}
                          type="button"
                          data-chart-code={item.fileId}
                          className={`runtime-toc-item${item.fileId === activeFile?.fileId ? ' active' : ''}`}
                          onClick={() => {
                            setActiveThirdLevel(group.label);
                            setActiveFile(item);
                          }}
                        >
                          {item.title}
                        </button>
                      )) : (
                        <button type="button" className="runtime-toc-item" disabled>暂无资源</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          ) : null}
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
