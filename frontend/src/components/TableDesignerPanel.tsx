import { Button, Empty, Input, InputNumber, Select, Space } from 'antd';
import type { DashboardComponent, DataPool, TemplateDefinition } from '../types/dashboard';
import {
  buildInitialTableDsl,
  normalizeDslConfig,
  resolveModel,
  syncTableComponentWithModel
} from '../utils/dashboard';

function isSelectableField(dataType: string, fieldRole: string) {
  return fieldRole === 'dimension'
    || fieldRole === 'attribute'
    || ['date', 'datetime', 'string', 'number'].includes(dataType);
}

export default function TableDesignerPanel(props: {
  component: DashboardComponent;
  dataPools: DataPool[];
  templates: TemplateDefinition[];
  previewRows?: Record<string, unknown>[];
  onChange: (component: DashboardComponent) => void;
  onPreview: () => void;
}) {
  const model = resolveModel(props.dataPools, props.component.modelCode);
  const fields = model?.fields ?? [];

  if (!model) {
    return (
      <div className="config-panel-shell">
        <div className="panel-card property-panel property-panel-empty">
          <div className="panel-section">
            <Empty description="请先为表格选择数据模型" />
          </div>
        </div>
      </div>
    );
  }

  const cartesianTemplateCode =
    props.templates.find(template => (template.capability?.renderer ?? template.rendererCode) === 'cartesian_combo')
      ?.templateCode
    ?? 'cartesian_combo';

  const templateOptions = [
    { label: '笛卡尔坐标图', value: cartesianTemplateCode },
    { label: '表格', value: 'table' }
  ];

  const modelOptions = props.dataPools.map(dataPool => ({
    label: dataPool.dataPoolName,
    value: dataPool.dataPoolCode
  }));

  const fieldOptions = fields
    .filter(field => isSelectableField(field.dataType, field.fieldRole))
    .map(field => ({
      label: field.fieldNameCn || field.fieldName || field.fieldCode,
      value: field.fieldCode
    }));

  const tableTemplate = props.component.dslConfig.tableDsl?.template;

  const applyComponent = (updater: (component: DashboardComponent) => DashboardComponent, regenerate = false) => {
    const nextRaw = updater(props.component);
    const normalized = {
      ...nextRaw,
      dslConfig: normalizeDslConfig(nextRaw.dslConfig, resolveModel(props.dataPools, nextRaw.modelCode))
    };
    const next = regenerate
      ? syncTableComponentWithModel(
        normalized,
        resolveModel(props.dataPools, normalized.modelCode),
        props.previewRows ?? []
      )
      : normalized;
    props.onChange(next);
  };

  const updateTableTemplate = (patch: Partial<NonNullable<typeof tableTemplate>>, regenerate = true) => {
    const nextColumnFields = patch.columnFields ?? tableTemplate?.columnFields ?? [];
    applyComponent(component => ({
      ...component,
      componentType: 'table',
      templateCode: 'table',
      dslConfig: {
        ...component.dslConfig,
        queryDsl: {
          ...component.dslConfig.queryDsl,
          dimensionField: nextColumnFields[0] ?? '',
          dimensionFields: nextColumnFields,
          dimensions: nextColumnFields,
          metrics: []
        },
        tableDsl: buildInitialTableDsl({
          ...component,
          dslConfig: {
            ...component.dslConfig,
            queryDsl: {
              ...component.dslConfig.queryDsl,
              dimensionField: nextColumnFields[0] ?? '',
              dimensionFields: nextColumnFields,
              dimensions: nextColumnFields,
              metrics: []
            },
            tableDsl: {
              ...component.dslConfig.tableDsl!,
              template: {
                ...component.dslConfig.tableDsl!.template,
                ...patch,
                rowFields: [],
                valueFields: []
              }
            }
          }
        }, model, props.previewRows ?? [])
      }
    }), regenerate);
  };

  return (
    <div className="config-panel-shell">
      <div className="panel-card property-panel">
        <div className="property-panel-scroll">
          <div className="panel-section">
            <h3 className="panel-title">基础配置</h3>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <div className="metric-field-label">图表标题</div>
                <Input
                  value={props.component.dslConfig.visualDsl.title}
                  onChange={event => applyComponent(component => ({
                    ...component,
                    dslConfig: {
                      ...component.dslConfig,
                      visualDsl: {
                        ...component.dslConfig.visualDsl,
                        title: event.target.value
                      }
                    }
                  }))}
                />
              </div>
              <div>
                <div className="metric-field-label">图表类型</div>
                <Select
                  style={{ width: '100%' }}
                  value={props.component.templateCode}
                  options={templateOptions}
                  onChange={value => applyComponent(component => ({
                    ...component,
                    templateCode: value,
                    componentType: value === 'table' ? 'table' : 'chart'
                  }))}
                />
              </div>
              <div>
                <div className="metric-field-label">数据模型</div>
                <Select
                  style={{ width: '100%' }}
                  value={props.component.modelCode}
                  options={modelOptions}
                  onChange={value => applyComponent(component => ({
                    ...component,
                    modelCode: value,
                    dslConfig: {
                      ...component.dslConfig,
                      queryDsl: {
                        ...component.dslConfig.queryDsl,
                        modelCode: value,
                        datasetCode: value
                      }
                    }
                  }), true)}
                />
              </div>
            </Space>
          </div>

          <div className="panel-section">
            <h3 className="panel-title">列配置</h3>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <div className="metric-field-label">展示字段</div>
                <Select
                  mode="multiple"
                  style={{ width: '100%' }}
                  value={tableTemplate?.columnFields ?? []}
                  options={fieldOptions}
                  onChange={value => updateTableTemplate({ columnFields: value })}
                />
              </div>
            </Space>
          </div>

          <div className="panel-section">
            <h3 className="panel-title">数值着色</h3>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <div className="metric-field-label">阈值 x</div>
                <InputNumber
                  style={{ width: '100%' }}
                  value={tableTemplate?.threshold ?? 0}
                  onChange={value => updateTableTemplate({ threshold: Number(value ?? 0) })}
                />
              </div>
              <div>
                <div className="metric-field-label">大于 x 的颜色</div>
                <input
                  className="simple-color-input"
                  type="color"
                  value={tableTemplate?.gtColor ?? '#fecaca'}
                  onChange={event => updateTableTemplate({ gtColor: event.target.value })}
                />
              </div>
              <div>
                <div className="metric-field-label">小于等于 x 的颜色</div>
                <input
                  className="simple-color-input"
                  type="color"
                  value={tableTemplate?.lteColor ?? '#dcfce7'}
                  onChange={event => updateTableTemplate({ lteColor: event.target.value })}
                />
              </div>
            </Space>
          </div>
        </div>

        <div className="panel-section property-panel-footer">
          <Space>
            <Button type="primary" onClick={props.onPreview}>刷新预览</Button>
          </Space>
        </div>
      </div>
    </div>
  );
}
