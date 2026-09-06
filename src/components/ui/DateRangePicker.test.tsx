import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateRangePicker } from '@/components/ui/DateRangePicker'

describe('DateRangePicker', () => {
  it('shows the placeholder header when nothing is selected', () => {
    render(<DateRangePicker initialMonth="2025-06-10" />)
    expect(screen.getByText('Start Date → End Date')).toBeInTheDocument()
  })

  it('sets the first click as the start date', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateRangePicker initialMonth="2025-06-10" onChange={onChange} />)
    // Click the 15th
    await user.click(screen.getByRole('button', { name: '15' }))
    const called = onChange.mock.calls[0][0]
    expect(called.start).toBe('2025-06-15')
    expect(called.end).toBeNull()
  })

  it('sets the second later click as the end date', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateRangePicker initialMonth="2025-06-10" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '15' }))
    await user.click(screen.getByRole('button', { name: '20' }))
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(last.start).toBe('2025-06-15')
    expect(last.end).toBe('2025-06-20')
  })

  it('overwrites the start when the second click is before the start', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateRangePicker initialMonth="2025-06-10" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '20' }))
    await user.click(screen.getByRole('button', { name: '10' }))
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(last.start).toBe('2025-06-10')
    expect(last.end).toBeNull()
  })

  it('starts a new selection when both dates are already set', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<DateRangePicker initialMonth="2025-06-10" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '10' }))
    await user.click(screen.getByRole('button', { name: '20' }))
    await user.click(screen.getByRole('button', { name: '12' }))
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(last.start).toBe('2025-06-12')
    expect(last.end).toBeNull()
  })

  it('displays the selected range in the header', async () => {
    const user = userEvent.setup()
    render(<DateRangePicker initialMonth="2025-06-10" />)
    await user.click(screen.getByRole('button', { name: '10' }))
    await user.click(screen.getByRole('button', { name: '20' }))
    expect(screen.getByText('Jun 10, 2025 → Jun 20, 2025')).toBeInTheDocument()
  })
})
