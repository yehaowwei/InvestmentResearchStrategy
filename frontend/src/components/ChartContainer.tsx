import { Card } from 'antd';
import type { ReactNode } from 'react';

export default function ChartContainer(props: {
  title?: string;
  subtitle?: string;
  tag?: string;
  extra?: ReactNode;
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  hideHeader?: boolean;
}) {
  return (
    <Card className={`component-card ${props.selected ? 'grid-item-selected' : ''}`} onClick={props.onClick}>
      {props.hideHeader ? null : (
        <div className="chart-card-header">
          <div>
            {props.tag ? <div className="chart-card-tag">{props.tag}</div> : null}
            <div className="chart-card-title">{props.title}</div>
            {props.subtitle ? <div className="chart-card-subtitle">{props.subtitle}</div> : null}
          </div>
          <div onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
            {props.extra}
          </div>
        </div>
      )}
      <div className="chart-host">{props.children}</div>
    </Card>
  );
}
