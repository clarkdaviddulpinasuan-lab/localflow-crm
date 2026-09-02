import type { PaginatedResponse } from '@/types'

export interface QueryParams<T> {
  search?: string
  searchFields?: (keyof T)[]
  filters?: Partial<Record<keyof T, unknown>>
  sortBy?: keyof T
  sortDir?: 'asc' | 'desc'
  page?: number
  perPage?: number
}

export function applyQuery<T>(items: T[], params: QueryParams<T> = {}): PaginatedResponse<T> {
  let result = [...items]

  if (params.search && params.searchFields && params.searchFields.length > 0) {
    const term = params.search.toLowerCase()
    result = result.filter((item) =>
      params.searchFields!.some((field) => {
        const value = item[field]
        return value != null && String(value).toLowerCase().includes(term)
      })
    )
  }

  if (params.filters) {
    const filters = params.filters
    result = result.filter((item) =>
      Object.entries(filters).every(([key, value]) => {
        if (value === undefined || value === '' || value === null) return true
        return item[key as keyof T] === value
      })
    )
  }

  if (params.sortBy) {
    const dir = params.sortDir === 'desc' ? -1 : 1
    result.sort((a, b) => {
      const av = a[params.sortBy!]
      const bv = b[params.sortBy!]
      if (av == null || bv == null) return 0
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
  }

  const page = params.page ?? 1
  const perPage = params.perPage ?? 10
  const total = result.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const start = (page - 1) * perPage

  return {
    data: result.slice(start, start + perPage),
    total,
    page,
    per_page: perPage,
    total_pages: totalPages,
  }
}

export function parseSearchTerm<T>(items: T[], search: string, fields: (keyof T)[]): T[] {
  if (!search) return items
  const term = search.toLowerCase()
  return items.filter((item) =>
    fields.some((field) => {
      const value = item[field]
      return value != null && String(value).toLowerCase().includes(term)
    })
  )
}
