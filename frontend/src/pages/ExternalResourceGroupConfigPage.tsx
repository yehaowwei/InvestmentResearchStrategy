import { DeleteOutlined, DragOutlined, LinkOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Radio, Space, Spin, Tag, message } from 'antd';
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ExternalResourceGroup } from '../types/dashboard';

function notifyExternalResourceChanged() {
  window.dispatchEvent(new CustomEvent('external-resource-groups-changed'));
}

function reorderItemsPreview<T>(items: T[], fromIndex: number, toIndex: number) {
  const nextItems = [...items];
  const [target] = nextItems.splice(fromIndex, 1);
  if (target == null) {
    return items;
  }
  nextItems.splice(toIndex, 0, target);
  return nextItems;
}

function resolveClosestSortIdFromPoint(clientX: number, clientY: number) {
  const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-resource-sort-id]');
  return element?.dataset.resourceSortId;
}

function normalizeThirdLevelName(value?: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : '未配置三级目录';
}

export default function ExternalResourceGroupConfigPage() {
  const navigate = useNavigate();
  const params = useParams();
  const groupId = params.groupId ?? '';
  const [group, setGroup] = useState<ExternalResourceGroup>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [resourceType, setResourceType] = useState<'HTML' | 'LINK'>('HTML');
  const [resourceName, setResourceName] = useState('');
  const [thirdLevelName, setThirdLevelName] = useState('');
  const [resourceHref, setResourceHref] = useState('');
  const [resourceFile, setResourceFile] = useState<File>();
  const [draggingFileId, setDraggingFileId] = useState<string>();
  const [dragOverFileId, setDragOverFileId] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draggingFileIdRef = useRef<string>();
  const dragOverFileIdRef = useRef<string>();
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const loadGroup = () => {
    setLoading(true);
    setError(undefined);
    api.listExternalResourceGroups()
      .then(groups => {
        const nextGroup = groups.find(item => item.groupId === groupId);
        if (!nextGroup) {
          throw new Error('外部资源目录不存在');
        }
        setGroup(nextGroup);
      })
      .catch(loadError => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : '目录资源加载失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  useEffect(() => () => {
    dragCleanupRef.current?.();
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  const resetResourceForm = () => {
    setResourceType('HTML');
    setResourceName('');
    setThirdLevelName('');
    setResourceHref('');
    setResourceFile(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveResource = async () => {
    if (!resourceName.trim()) {
      message.warning('请输入资源名称');
      return;
    }
    if (resourceType === 'HTML' && !resourceFile) {
      message.warning('请选择 HTML 文件');
      return;
    }
    if (resourceType === 'LINK' && !resourceHref.trim()) {
      message.warning('请输入链接地址');
      return;
    }
    setUploading(true);
    try {
      const nextGroup = resourceType === 'HTML'
        ? await api.uploadExternalResourceFiles(groupId, [resourceFile as File], {
          resourceName: resourceName.trim(),
          thirdLevelName: thirdLevelName.trim() || undefined
        })
        : await api.createExternalResourceLink(groupId, {
          title: resourceName.trim(),
          href: resourceHref.trim(),
          thirdLevelName: thirdLevelName.trim() || undefined,
          resourceType: 'LINK'
        });
      setGroup(nextGroup);
      notifyExternalResourceChanged();
      message.success('资源已保存');
      setResourceOpen(false);
      resetResourceForm();
    } catch (uploadError) {
      console.error(uploadError);
      message.error(uploadError instanceof Error ? uploadError.message : '资源保存失败');
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      await api.deleteExternalResourceFile(groupId, fileId);
      loadGroup();
      notifyExternalResourceChanged();
      message.success('资源已删除');
    } catch (deleteError) {
      console.error(deleteError);
      message.error(deleteError instanceof Error ? deleteError.message : '资源删除失败');
    }
  };

  const finishDrag = async () => {
    const sourceId = draggingFileIdRef.current;
    const targetId = dragOverFileIdRef.current;
    const files = group?.files ?? [];
    if (sourceId && targetId && sourceId !== targetId) {
      const fromIndex = files.findIndex(item => item.fileId === sourceId);
      const toIndex = files.findIndex(item => item.fileId === targetId);
      if (fromIndex >= 0 && toIndex >= 0) {
        const preview = reorderItemsPreview(files, fromIndex, toIndex);
        setGroup(current => (current ? { ...current, files: preview } : current));
        try {
          setSavingOrder(true);
          const nextGroup = await api.reorderExternalResourceFiles(groupId, preview.map(item => item.fileId));
          setGroup(nextGroup);
          message.success('资源顺序已更新');
        } catch (saveError) {
          console.error(saveError);
          message.error(saveError instanceof Error ? saveError.message : '资源顺序保存失败');
          loadGroup();
        } finally {
          setSavingOrder(false);
        }
      }
    }

    setDraggingFileId(undefined);
    setDragOverFileId(undefined);
    draggingFileIdRef.current = undefined;
    dragOverFileIdRef.current = undefined;
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  const startDrag = (event: ReactMouseEvent<HTMLElement>, fileId: string) => {
    if (event.button !== 0 || savingOrder) {
      return;
    }
    event.preventDefault();
    dragCleanupRef.current?.();
    setDraggingFileId(fileId);
    setDragOverFileId(undefined);
    draggingFileIdRef.current = fileId;
    dragOverFileIdRef.current = undefined;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const targetId = resolveClosestSortIdFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (!targetId || targetId === draggingFileIdRef.current) {
        if (dragOverFileIdRef.current !== undefined) {
          dragOverFileIdRef.current = undefined;
          setDragOverFileId(undefined);
        }
        return;
      }
      if (dragOverFileIdRef.current !== targetId) {
        dragOverFileIdRef.current = targetId;
        setDragOverFileId(targetId);
      }
    };

    const handleMouseUp = () => {
      void finishDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    dragCleanupRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  };

  if (error) {
    return <Alert type="error" showIcon message="目录资源加载失败" description={error} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{group?.name ?? '目录资源配置'}</h2>
          <div className="page-subtitle">
            在这个二级目录下配置资源。资源类型支持 HTML 和链接，三级目录可选；配置后会同步显示在右侧导航和页面标签中。
          </div>
        </div>
        <Space wrap size={12}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            style={{ display: 'none' }}
            onChange={event => setResourceFile(event.target.files?.[0])}
          />
          <Button onClick={() => navigate('/external-resource-config')}>返回目录列表</Button>
          <Button type="primary" icon={<UploadOutlined />} loading={uploading} onClick={() => setResourceOpen(true)}>
            新增资源
          </Button>
        </Space>
      </div>

      {group ? (
        <div className="external-config-group-summary">
          <Tag color="blue">{group.parentName || '友情链接'}</Tag>
          <Tag color="gold">二级目录：{group.name}</Tag>
          <Tag>资源数：{group.files.length}</Tag>
        </div>
      ) : null}

      {loading ? (
        <div className="panel-card canvas-card canvas-empty">
          <Spin tip="目录资源加载中" />
        </div>
      ) : group && group.files.length > 0 ? (
        <div className="panel-card external-config-card">
          <div className="external-config-file-list">
            {group.files.map(file => (
              <div
                key={file.fileId}
                data-resource-sort-id={file.fileId}
                className={`external-config-file-item${draggingFileId === file.fileId ? ' external-config-file-item-dragging' : ''}${dragOverFileId === file.fileId && draggingFileId !== file.fileId ? ' external-config-file-item-drop-target' : ''}`}
              >
                <div className="external-config-file-main">
                  <div className="external-config-file-name">{file.title}</div>
                  <div className="external-config-file-meta">
                    类型：{file.resourceType === 'LINK' ? '链接' : 'HTML'}
                    {' · '}
                    三级目录：{normalizeThirdLevelName(file.thirdLevelName)}
                    {file.resourceType === 'HTML' && file.fileName ? ` · 文件：${file.fileName}` : null}
                  </div>
                </div>
                <Space size={8} wrap>
                  <Button
                    icon={<DragOutlined />}
                    onMouseDown={event => startDrag(event, file.fileId)}
                    title="拖拽排序"
                    aria-label="拖拽排序"
                  >
                    拖拽
                  </Button>
                  <Button icon={<LinkOutlined />} onClick={() => window.open(file.href, '_blank', 'noopener,noreferrer')}>
                    打开
                  </Button>
                  <Popconfirm
                    title="确认删除这个资源吗？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => deleteFile(file.fileId)}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      删除
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="panel-card canvas-card canvas-empty">
          <Empty description="当前目录还没有资源" />
        </div>
      )}

      <Modal
        title="新增资源"
        open={resourceOpen}
        okText="保存"
        cancelText="取消"
        confirmLoading={uploading}
        onOk={() => void saveResource()}
        onCancel={() => {
          setResourceOpen(false);
          resetResourceForm();
        }}
      >
        <div className="external-config-create-form">
          <div className="strategy-info-row">
            <span className="strategy-selection-title">资源类型</span>
            <Radio.Group value={resourceType} onChange={event => setResourceType(event.target.value)}>
              <Radio.Button value="HTML">HTML</Radio.Button>
              <Radio.Button value="LINK">链接</Radio.Button>
            </Radio.Group>
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">资源名称</span>
            <Input value={resourceName} placeholder="例如：估值速览表" onChange={event => setResourceName(event.target.value)} />
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">所属三级目录</span>
            <Input value={thirdLevelName} placeholder="例如：估值面，可不填" onChange={event => setThirdLevelName(event.target.value)} />
          </div>
          {resourceType === 'HTML' ? (
            <div className="strategy-info-row">
              <span className="strategy-selection-title">HTML 文件</span>
              <Space wrap>
                <Button onClick={() => fileInputRef.current?.click()}>选择文件</Button>
                <span className="external-config-file-meta">{resourceFile?.name ?? '未选择文件'}</span>
              </Space>
            </div>
          ) : (
            <div className="strategy-info-row">
              <span className="strategy-selection-title">链接地址</span>
              <Input value={resourceHref} placeholder="https://example.com" onChange={event => setResourceHref(event.target.value)} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
