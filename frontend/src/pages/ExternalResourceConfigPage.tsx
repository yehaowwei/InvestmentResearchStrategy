import { DeleteOutlined, FolderAddOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Select, Space, Spin, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ExternalResourceGroup } from '../types/dashboard';

function notifyExternalResourceChanged() {
  window.dispatchEvent(new CustomEvent('external-resource-groups-changed'));
}

const ROOT_DIRECTORY_OPTIONS = [{ label: '友情链接', value: '友情链接' }];

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
  const [createParentName, setCreateParentName] = useState('友情链接');

  const sortedGroups = useMemo(
    () => groups.slice().sort((a, b) => a.order - b.order),
    [groups]
  );

  const loadGroups = () => {
    setLoading(true);
    setError(undefined);
    api.listExternalResourceGroups()
      .then(setGroups)
      .catch(loadError => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : '链接配置加载失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const createGroup = async () => {
    if (!createName.trim()) {
      message.warning('请输入二级目录名称');
      return;
    }
    setCreating(true);
    try {
      await api.createExternalResourceGroup({
        name: createName.trim(),
        slug: createSlug.trim() || undefined,
        description: createDescription.trim() || undefined,
        parentName: createParentName.trim() || '友情链接'
      });
      message.success('二级目录已创建');
      notifyExternalResourceChanged();
      setCreateOpen(false);
      setCreateName('');
      setCreateSlug('');
      setCreateDescription('');
      setCreateParentName('友情链接');
      loadGroups();
    } catch (createError) {
      console.error(createError);
      message.error(createError instanceof Error ? createError.message : '二级目录创建失败');
    } finally {
      setCreating(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      await api.deleteExternalResourceGroup(groupId);
      message.success('二级目录已删除');
      notifyExternalResourceChanged();
      loadGroups();
    } catch (deleteError) {
      console.error(deleteError);
      message.error(deleteError instanceof Error ? deleteError.message : '二级目录删除失败');
    }
  };

  if (error) {
    return <Alert type="error" showIcon message="链接配置加载失败" description={error} />;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">链接配置</h2>
          <div className="page-subtitle">
            先维护左侧菜单的二级目录，再进入目录配置资源。每个资源都可以选择类型为 HTML 或链接，并可绑定可选的三级目录。
          </div>
        </div>
        <Space wrap size={12}>
          <Button type="primary" icon={<FolderAddOutlined />} onClick={() => setCreateOpen(true)}>
            新建二级目录
          </Button>
        </Space>
      </div>

      {loading ? (
        <div className="panel-card canvas-card canvas-empty">
          <Spin tip="链接配置加载中" />
        </div>
      ) : sortedGroups.length > 0 ? (
        <div className="external-config-grid">
          {sortedGroups.map(group => (
            <section key={group.groupId} className="panel-card external-config-card">
              <div className="external-config-card-head">
                <div>
                  <h3 className="external-config-card-title">{group.name}</h3>
                  <div className="external-config-card-subtitle">
                    <span>一级目录：{group.parentName || '友情链接'}</span>
                    <span>路由：/external-resource/{group.slug}</span>
                    <span>{group.files.length} 个资源</span>
                  </div>
                </div>
                <Space wrap size={8}>
                  <Button
                    icon={<SettingOutlined />}
                    onClick={() => navigate(`/external-resource-config/${group.groupId}`)}
                  >
                    进入配置
                  </Button>
                  <Popconfirm
                    title="确认删除这个二级目录吗？"
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
          <Empty description="还没有配置任何友情链接二级目录" />
        </div>
      )}

      <Modal
        title="新建二级目录"
        open={createOpen}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        onOk={() => void createGroup()}
        onCancel={() => setCreateOpen(false)}
      >
        <div className="external-config-create-form">
          <div className="strategy-info-row">
            <span className="strategy-selection-title">一级目录</span>
            <Select
              value={createParentName}
              options={ROOT_DIRECTORY_OPTIONS}
              onChange={setCreateParentName}
            />
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">二级目录名称</span>
            <Input value={createName} placeholder="例如：转债研究" onChange={event => setCreateName(event.target.value)} />
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">路由标识</span>
            <Input value={createSlug} placeholder="例如：convertible-board" onChange={event => setCreateSlug(event.target.value)} />
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">描述</span>
            <Input.TextArea
              value={createDescription}
              rows={3}
              placeholder="例如：转债研究相关的 HTML 页面与外部链接"
              onChange={event => setCreateDescription(event.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
