import { DeleteOutlined, FolderAddOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Space, Spin, message } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ExternalResourceGroup } from '../types/dashboard';

function notifyExternalResourceChanged() {
  window.dispatchEvent(new CustomEvent('external-resource-groups-changed'));
}

export default function ExternalResourceConfigPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ExternalResourceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createDescription, setCreateDescription] = useState('');

  const loadGroups = () => {
    setLoading(true);
    setError(undefined);
    api.listExternalResourceGroups()
      .then(setGroups)
      .catch(loadError => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : '外部资源配置加载失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const createGroup = async () => {
    if (!createName.trim()) {
      message.warning('请输入一级目录名称');
      return;
    }
    setCreating(true);
    try {
      await api.createExternalResourceGroup({
        name: createName.trim(),
        slug: createSlug.trim() || undefined,
        description: createDescription.trim() || undefined
      });
      message.success('一级目录已创建');
      notifyExternalResourceChanged();
      setCreateOpen(false);
      setCreateName('');
      setCreateSlug('');
      setCreateDescription('');
      loadGroups();
    } catch (createError) {
      console.error(createError);
      message.error(createError instanceof Error ? createError.message : '一级目录创建失败');
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      await api.deleteExternalResourceGroup(groupId);
      message.success('一级目录已删除');
      notifyExternalResourceChanged();
      loadGroups();
    } catch (deleteError) {
      console.error(deleteError);
      message.error(deleteError instanceof Error ? deleteError.message : '一级目录删除失败');
    }
  };

  if (error) {
    return <Alert type="error" showIcon message="外部资源配置加载失败" description={error} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">外部资源配置</h2>
          <div className="page-subtitle">先管理一级目录，再进入目录上传、删除和拖拽排序 HTML 资源。</div>
        </div>
        <Space wrap size={12}>
          <Button type="primary" icon={<FolderAddOutlined />} onClick={() => setCreateOpen(true)}>
            新建一级目录
          </Button>
        </Space>
      </div>

      {loading ? (
        <div className="panel-card canvas-card canvas-empty">
          <Spin tip="外部资源配置加载中" />
        </div>
      ) : groups.length > 0 ? (
        <div className="external-config-grid">
          {groups.map(group => (
            <section key={group.groupId} className="panel-card external-config-card">
              <div className="external-config-card-head">
                <div>
                  <h3 className="external-config-card-title">{group.name}</h3>
                  <div className="external-config-card-subtitle">
                    <span>路由：/external-resource/{group.slug}</span>
                    <span>{group.files.length} 个 HTML 资源</span>
                  </div>
                </div>
                <Space wrap size={8}>
                  <Button
                    icon={<SettingOutlined />}
                    onClick={() => navigate(`/external-resource-config/${group.groupId}`)}
                  >
                    进入目录
                  </Button>
                  <Popconfirm
                    title="确认删除这个一级目录吗？"
                    okText="删除"
                    cancelText="取消"
                    onConfirm={() => deleteGroup(group.groupId)}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      删除目录
                    </Button>
                  </Popconfirm>
                </Space>
              </div>
              {group.description ? <div className="external-config-card-description">{group.description}</div> : null}
            </section>
          ))}
        </div>
      ) : (
        <div className="panel-card canvas-card canvas-empty">
          <Empty description="还没有配置任何外部资源一级目录" />
        </div>
      )}

      <Modal
        title="新建一级目录"
        open={createOpen}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        onOk={() => void createGroup()}
        onCancel={() => setCreateOpen(false)}
      >
        <div className="external-config-create-form">
          <div className="strategy-info-row">
            <span className="strategy-selection-title">目录名称</span>
            <Input value={createName} placeholder="例如：转债看板" onChange={event => setCreateName(event.target.value)} />
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">路由标识</span>
            <Input
              value={createSlug}
              placeholder="例如：convertible-board（只填最后一段）"
              onChange={event => setCreateSlug(event.target.value)}
            />
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">描述</span>
            <Input.TextArea
              value={createDescription}
              rows={3}
              placeholder="这个一级目录展示什么资源"
              onChange={event => setCreateDescription(event.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
