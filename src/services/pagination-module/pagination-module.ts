export function applyPagination<TList>(list: Array<TList>, offset: number, limit: number): Array<TList> {
  const startValue: number = Math.max(0, offset);
  const endValue: number = limit > 0 ? Math.min(offset + limit, list.length + 1) : list.length + 1;

  return list.slice(startValue, endValue);
}
