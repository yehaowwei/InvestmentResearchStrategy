export function formatNumberMax3(value: unknown) {
  if (value == null || value === '') {
    return '';
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value);
  }
  const text = String(value);
  const decimalPart = text.includes('.') ? text.split('.')[1]?.replace(/[^0-9].*$/, '') ?? '' : '';
  if (decimalPart.length <= 3) {
    return text;
  }
  return numeric.toFixed(3);
}
