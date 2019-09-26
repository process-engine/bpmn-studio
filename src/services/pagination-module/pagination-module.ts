export function applyPagination<TList>(list: Array<TList>, offset: number, limit: number): Array<TList> {
  const paginatedList: Array<TList> = list.slice();

  if (offset > 0) {
    paginatedList.splice(0, offset);
  }

  if (limit > 0) {
    paginatedList.splice(limit, paginatedList.length - limit);
  }

  return paginatedList;
}
