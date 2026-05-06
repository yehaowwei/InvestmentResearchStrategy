import { SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import type { ComponentProps } from 'react';

type AppSearchInputProps = ComponentProps<typeof Input.Search>;

export default function AppSearchInput(props: AppSearchInputProps) {
  const { className, enterButton, ...rest } = props;

  return (
    <Input.Search
      {...rest}
      enterButton={enterButton ?? <SearchOutlined />}
      className={['app-search-input', className].filter(Boolean).join(' ')}
    />
  );
}
