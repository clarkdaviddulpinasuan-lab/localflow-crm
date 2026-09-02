import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'
import { Badge, getStatusBadge } from '@/components/ui/Badge'
import { KpiCard } from '@/components/KpiCard'
import { Modal } from '@/components/ui/Modal'

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click me</Button>)
    await user.click(screen.getByRole('button', { name: 'Click me' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when loading and does not fire onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn).toBeDisabled()
    await user.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('applies danger variant class', () => {
    render(<Button variant="danger">Delete</Button>)
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-danger-600')
  })
})

describe('Badge', () => {
  it('renders label text', () => {
    render(<Badge variant="success">Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('maps statuses via getStatusBadge', () => {
    expect(getStatusBadge('paid')).toEqual({ variant: 'success', label: 'Paid' })
    expect(getStatusBadge('pending').variant).toBe('warning')
  })
})

describe('KpiCard', () => {
  it('renders label, value, and change', () => {
    render(
      <KpiCard
        kpi={{
          id: 'revenue',
          label: 'Revenue',
          value: 1200,
          display: '₱1,200',
          change: 10,
          changeLabel: 'vs last period',
          positiveIsGood: true,
          icon: 'revenue',
        }}
      />
    )
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('₱1,200')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('renders title and content when open', () => {
    render(
      <Modal open onClose={vi.fn()} title="Edit booking">
        <p>Modal body</p>
      </Modal>
    )
    expect(screen.getByText('Edit booking')).toBeInTheDocument()
    expect(screen.getByText('Modal body')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Edit booking">
        <p>Modal body</p>
      </Modal>
    )
    expect(screen.queryByText('Modal body')).not.toBeInTheDocument()
  })
})
