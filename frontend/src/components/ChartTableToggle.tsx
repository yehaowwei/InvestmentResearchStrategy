import { Segmented } from 'antd';

export default function ChartTableToggle(props: { value: 'chart' | 'table'; onChange: (value: 'chart' | 'table') => void }) {
  return (
    <div className="chart-toggle" onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <Segmented options={[{ label: '图表', value: 'chart' }, { label: '数据表', value: 'table' }]} value={props.value} onChange={value => props.onChange(value as 'chart' | 'table')} />
    </div>
  );
}
