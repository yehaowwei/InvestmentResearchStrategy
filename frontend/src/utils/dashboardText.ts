import type { DatasetModel } from '../types/dashboard';

export function isSelectableTableField(dataType: string, fieldRole: string) {
  return fieldRole === 'dimension'
    || fieldRole === 'attribute'
    || ['date', 'datetime', 'string', 'number'].includes(dataType);
}

export function getDefaultTableColumnFields(model?: DatasetModel, limit = 6) {
  return (model?.fields ?? [])
    .filter(field => isSelectableTableField(field.dataType, field.fieldRole))
    .slice(0, limit)
    .map(field => field.fieldCode);
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function resolveModel(models: DatasetModel[], modelCode?: string) {
  return models.find(model => model.modelCode === modelCode);
}

export function normalizeDisplayText(value?: string, fallback = '') {
  if (!value) return fallback;

  const chars = Array.from(value);
  if (chars.length === 0 || chars.some(char => char.charCodeAt(0) > 0xFF)) {
    return value;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(chars.map(char => char.charCodeAt(0))));
  } catch {
    return value;
  }
}
