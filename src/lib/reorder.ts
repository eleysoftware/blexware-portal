/** Pure list-reordering helpers shared by the import phase list and the milestone board. */

/** Move the item at `from` to index `to`, clamping both ends. Returns a new array. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;
  const target = Math.max(0, Math.min(to, items.length - 1));
  if (target === from) return items;
  const next = [...items];
  const [row] = next.splice(from, 1);
  next.splice(target, 0, row as T);
  return next;
}

/** Shift the item at `index` one step up (-1) or down (+1). */
export function nudgeItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  return moveItem(items, index, index + direction);
}
