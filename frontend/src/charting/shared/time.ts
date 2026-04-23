export function normalizeZoomRange(context?: { zoomRange?: { start: number; end: number } }) {
  const start = context?.zoomRange?.start ?? 0;
  const end = context?.zoomRange?.end ?? 100;
  return {
    start: Math.max(0, Math.min(start, 100)),
    end: Math.max(0, Math.min(end, 100))
  };
}

export function formatTimeLabel(value: string | number | undefined | null, axisValues: string[] = []) {
  if (value == null) return '';

  const resolveAxisValue = (raw: string | number) => {
    if (typeof raw === 'number' && Number.isFinite(raw) && axisValues.length > 0) {
      const index = Math.max(0, Math.min(axisValues.length - 1, Math.round(raw)));
      return axisValues[index];
    }
    const textValue = String(raw).trim();
    if (/^\d+(\.\d+)?$/.test(textValue) && axisValues.length > 0) {
      const numericIndex = Number(textValue);
      if (Number.isFinite(numericIndex)) {
        const index = Math.max(0, Math.min(axisValues.length - 1, Math.round(numericIndex)));
        if (Math.abs(index - numericIndex) < 0.0001) {
          return axisValues[index];
        }
      }
    }
    return textValue;
  };

  const text = resolveAxisValue(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.replace(/\//g, '-');
  if (/^\d{8}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{2}$/.test(text)) return text.replace('/', '-');
  if (/^\d{6}$/.test(text)) return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/.test(text)) return text.slice(0, 16).replace('T', ' ');
  if (/^\d+$/.test(text)) return text;

  const time = new Date(text).getTime();
  if (Number.isFinite(time)) {
    const date = new Date(time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const hasTime = hours !== '00' || minutes !== '00';
    return hasTime ? `${year}-${month}-${day} ${hours}:${minutes}` : `${year}-${month}-${day}`;
  }

  return text;
}

export function resolveVisibleIndexRange(length: number, context?: { zoomRange?: { start: number; end: number } }) {
  if (length <= 1) return { startIndex: 0, endIndex: Math.max(length - 1, 0) };
  const zoom = normalizeZoomRange(context);
  const startIndex = Math.max(0, Math.min(length - 1, Math.floor((zoom.start / 100) * (length - 1))));
  const endIndex = Math.max(startIndex, Math.min(length - 1, Math.ceil((zoom.end / 100) * (length - 1))));
  return { startIndex, endIndex };
}

export function parseTime(value: unknown) {
  if (value == null) return Number.NaN;
  const time = new Date(String(value)).getTime();
  return Number.isFinite(time) ? time : Number.NaN;
}
