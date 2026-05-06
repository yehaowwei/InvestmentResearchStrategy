export function reorderItemsPreview<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function normalizeSearchKeyword(value: string) {
  return value.trim().toLowerCase();
}

export function resolveActiveRowCodes(items: Array<{ chartCode: string; top: number; bottom: number }>) {
  if (items.length === 0) {
    return [];
  }

  const visibleCards = items.filter(item => item.bottom > 120);
  const sortedCards = (visibleCards.length > 0 ? visibleCards : items)
    .sort((a, b) => Math.abs(a.top - 140) - Math.abs(b.top - 140));
  const rowTop = sortedCards[0]?.top;
  if (rowTop == null) {
    return [];
  }

  return sortedCards
    .filter(item => Math.abs(item.top - rowTop) < 24)
    .slice(0, 3)
    .map(item => item.chartCode);
}

export function scrollContainerItemToCenter(container: HTMLDivElement, selector: string) {
  const activeItem = container.querySelector<HTMLElement>(selector);
  if (!activeItem) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();
  const nextTop = container.scrollTop + (itemRect.top - containerRect.top) - ((container.clientHeight - itemRect.height) / 2);
  container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
}

export function resolveClosestSortIdFromPoint(clientX: number, clientY: number, attributeName: string) {
  if (typeof document === 'undefined') {
    return undefined;
  }

  const selector = `[${attributeName}]`;
  const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(selector);
  return element?.getAttribute(attributeName) ?? undefined;
}
