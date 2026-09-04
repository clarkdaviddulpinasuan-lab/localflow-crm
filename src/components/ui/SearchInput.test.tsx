import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { rankMatches } from '@/utils/searchMatch'
import { SearchInput } from '@/components/ui/SearchInput'

const names = ['Carl', 'Charlie', 'Bob', 'Catherine']

describe('rankMatches', () => {
  it('ranks prefix matches before substring matches', () => {
    const res = rankMatches(names, 'c', (n) => n)
    // Prefix-first: Carl, Charlie, Catherine (start with 'c') before Bob? Bob doesn't match. Only 'c' matches.
    expect(res.map((r) => r.item)).toEqual(['Carl', 'Catherine', 'Charlie'])
  })

  it('returns prefix matches first then substring matches', () => {
    const pool = ['Amanda', 'Marco', 'Manny', 'Max']
    const res = rankMatches(pool, 'ma', (n) => n)
    const items = res.map((r) => r.item)
    // Prefix matches ('Marco', 'Manny', 'Max') rank before substring-only 'Amanda'.
    expect(items.slice(0, 3)).toEqual(expect.arrayContaining(['Marco', 'Manny', 'Max']))
    expect(items[3]).toBe('Amanda')
    expect(res.filter((r) => r.item !== 'Amanda').every((r) => r.rank === 0)).toBe(true)
  })

  it('returns an empty array for no matches or empty query', () => {
    expect(rankMatches(names, 'zzz', (n) => n)).toEqual([])
    expect(rankMatches(names, '', (n) => n)).toEqual([])
  })

  it('is case-insensitive', () => {
    const res = rankMatches(['Alpha', 'beta'], 'ALP', (n) => n)
    expect(res.map((r) => r.item)).toEqual(['Alpha'])
  })
})

describe('SearchInput', () => {
  it('shows ranking suggestions and a no-results message', async () => {
    const user = userEvent.setup()
    render(<SearchInput value="" onChange={() => {}} items={names} getLabel={(n) => n} />)
    await user.type(screen.getByRole('textbox'), 'c')
    // Prefix matches surface at the top
    const listItems = screen.getAllByRole('option').map((li) => li.textContent)
    expect(listItems[0]).toBe('Carl')
  })

  it('shows a no-results message when nothing matches', async () => {
    const user = userEvent.setup()
    render(
      <SearchInput value="" onChange={() => {}} items={names} getLabel={(n) => n} noResultsMessage="Nothing here" />
    )
    await user.type(screen.getByRole('textbox'), 'zzz')
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('selecting a suggestion commits its label via onChange', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SearchInput value="" onChange={onChange} items={names} getLabel={(n) => n} />)
    await user.click(screen.getByRole('textbox'))
    await user.type(screen.getByRole('textbox'), 'carl')
    await user.click(screen.getByText('Carl'))
    expect(onChange).toHaveBeenCalledWith('Carl')
  })
})
