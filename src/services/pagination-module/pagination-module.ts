export function applyPagination<TList>(list: Array<TList>, offset: number, limit: number): Array<TList> {
  const endValue: number = limit > 0 ? Math.min(offset + limit, list.length) : list.length;

  return list.slice(offset, endValue);
}
