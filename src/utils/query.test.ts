import { describe, it, expect } from 'vitest'
import { applyQuery, parseSearchTerm } from '@/utils/query'

interface Item {
  id: number
  name: string
  category: string
  price: number
}

const items: Item[] = [
  { id: 1, name: 'Apple', category: 'fruit', price: 30 },
  { id: 2, name: 'Banana', category: 'fruit', price: 20 },
  { id: 3, name: 'Carrot', category: 'vegetable', price: 15 },
  { id: 4, name: 'Apricot', category: 'fruit', price: 55 },
  { id: 5, name: 'Broccoli', category: 'vegetable', price: 25 },
]

describe('applyQuery', () => {
  it('returns everything by default with proper pagination metadata', () => {
    const res = applyQuery(items)
    expect(res.data).toHaveLength(5)
    expect(res.total).toBe(5)
    expect(res.page).toBe(1)
    expect(res.total_pages).toBe(1)
  })

  it('searches across the given fields (case-insensitive)', () => {
    const res = applyQuery(items, { search: 'ap', searchFields: ['name'] })
    expect(res.data.map((i) => i.name)).toEqual(['Apple', 'Apricot'])
  })

  it('applies exact-match filters', () => {
    const res = applyQuery(items, { filters: { category: 'fruit' } })
    expect(res.total).toBe(3)
  })

  it('ignores empty filter values', () => {
    const res = applyQuery(items, { filters: { category: '', price: undefined } })
    expect(res.total).toBe(5)
  })

  it('sorts ascending and descending', () => {
    const asc = applyQuery(items, { sortBy: 'price', sortDir: 'asc' })
    expect(asc.data[0].price).toBe(15)
    const desc = applyQuery(items, { sortBy: 'price', sortDir: 'desc' })
    expect(desc.data[0].price).toBe(55)
  })

  it('paginates correctly', () => {
    const res = applyQuery(items, { perPage: 2, page: 2 })
    expect(res.data).toHaveLength(2)
    expect(res.total_pages).toBe(3)
    expect(res.page).toBe(2)
  })
})

describe('parseSearchTerm', () => {
  it('returns all items when search is empty', () => {
    expect(parseSearchTerm(items, '', ['name'])).toHaveLength(5)
  })

  it('filters by matching fields', () => {
    const res = parseSearchTerm(items, 'ana', ['name'])
    expect(res.map((i) => i.name)).toEqual(['Banana'])
  })
})
