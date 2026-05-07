import { DeleteOutlined, EditOutlined, FolderAddOutlined, SettingOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Modal, Popconfirm, Select, Space, Spin, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { ExternalResourceGroup } from '../types/dashboard';

function notifyExternalResourceChanged() {
  window.dispatchEvent(new CustomEvent('external-resource-groups-changed'));
}

export default function ExternalResourceConfigPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ExternalResourceGroup[]>([]);
  const [directories, setDirectories] = useState<Array<{ label: string; value: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExternalResourceGroup>();
  const [groupName, setGroupName] = useState('');
  const [resourceSlug, setResourceSlug] = useState('');

  const sortedGroups = useMemo(
    () => groups.slice().sort((a, b) => a.order - b.order),
    [groups]
  );

  const loadData = () => {
    setLoading(true);
    setError(undefined);
    Promise.all([
      api.listExternalResourceGroups(),
      api.listExternalResourceDirectories()
    ])
      .then(([nextGroups, nextDirectories]) => {
        setGroups(nextGroups);
        setDirectories(nextDirectories);
      })
      .catch(loadError => {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : '链接配置加载失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingGroup(undefined);
    setGroupName('');
    setResourceSlug('');
    setModalOpen(true);
  };

  const openEdit = (group: ExternalResourceGroup) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setResourceSlug(group.slug);
    setModalOpen(true);
  };

  const saveGroup = async () => {
    if (!groupName.trim()) {
      message.warning('请输入二级目录名称');
      return;
    }
    setSaving(true);
    try {
      if (editingGroup) {
        await api.updateExternalResourceGroup(editingGroup.groupId, {
          name: groupName.trim(),
          slug: resourceSlug.trim() || undefined,
          parentName: '友情链接'
        });
        message.success('二级目录已修改');
      } else {
        await api.createExternalResourceGroup({
          name: groupName.trim(),
          slug: resourceSlug.trim() || undefined,
          parentName: '友情链接'
        });
        message.success('二级目录已创建');
      }
      notifyExternalResourceChanged();
      setModalOpen(false);
      loadData();
    } catch (saveError) {
      console.error(saveError);
      message.error(saveError instanceof Error ? saveError.message : '目录保存失败');
    } finally {
      setSaving(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      await api.deleteExternalResourceGroup(groupId);
      message.success('二级目录已删除');
      notifyExternalResourceChanged();
      loadData();
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
        </div>
        <Space wrap size={12}>
          <Button type="primary" icon={<FolderAddOutlined />} onClick={openCreate}>
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
                    <span>资源位置：{group.slug}</span>
                    <span>{group.files.length} 个资源</span>
                  </div>
                </div>
                <Space wrap size={8}>
                  <Button icon={<SettingOutlined />} onClick={() => navigate(`/external-resource-config/${group.groupId}`)}>
                    进入配置
                  </Button>
                  <Button icon={<EditOutlined />} onClick={() => openEdit(group)}>
                    修改
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
            </section>
          ))}
        </div>
      ) : (
        <div className="panel-card canvas-card canvas-empty">
          <Empty description="还没有配置任何友情链接二级目录" />
        </div>
      )}

      <Modal
        title={editingGroup ? '修改二级目录' : '新建二级目录'}
        open={modalOpen}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        onOk={() => void saveGroup()}
        onCancel={() => setModalOpen(false)}
      >
        <div className="external-config-create-form">
          <div className="strategy-info-row">
            <span className="strategy-selection-title">一级目录</span>
            <Input value="友情链接" disabled />
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">二级目录名称</span>
            <Input value={groupName} placeholder="例如：转债研究" onChange={event => setGroupName(event.target.value)} />
          </div>
          <div className="strategy-info-row">
            <span className="strategy-selection-title">资源位置</span>
            <Select
              showSearch
              allowClear
              value={resourceSlug || undefined}
              placeholder="选择后端可用资源文件夹"
              options={directories}
              onChange={value => setResourceSlug(value ?? '')}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
