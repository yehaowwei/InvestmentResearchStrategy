import { RobotOutlined } from '@ant-design/icons';
import { Empty } from 'antd';

type Props = {
  title: string;
};

export default function ModelPlaceholderPage({ title }: Props) {
  return (
    <div className="panel-card model-placeholder-page">
      <RobotOutlined className="model-placeholder-icon" />
      <h2 className="page-title">{title}</h2>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="模型能力正在纳入体系化管理"
      />
    </div>
  );
}
