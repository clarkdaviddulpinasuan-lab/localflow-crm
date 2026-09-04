export interface RankedMatch<T> {
  item: T
  /** 0 = prefix (starts with query), 1 = substring match. Lower ranks first. */
  rank: number
  /** Overall sort key for stability (rank, then alphabetical). */
  sortKey: string
}

/**
 * Case-insensitive, prefix-first ranking matcher used by SearchInput, Combobox
 * and the Command Palette so every search behaves identically.
 *
 * Prefix (starts-with) matches rank before substring matches; within each rank
 * items are ordered alphabetically by their match text.
 *
 * Returns all items that match the query (no limit), sorted best-first.
 */
export function rankMatches<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string
): RankedMatch<T>[] {
  const term = query.trim().toLowerCase()
  if (!term) return []

  const scored: RankedMatch<T>[] = []
  for (const item of items) {
    const text = getSearchText(item).toLowerCase()
    if (text.includes(term)) {
      const isPrefix = text.startsWith(term)
      scored.push({
        item,
        rank: isPrefix ? 0 : 1,
        sortKey: text,
      })
    }
  }

  return scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    return a.sortKey.localeCompare(b.sortKey)
  })
}
