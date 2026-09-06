import type { ReactNode } from 'react'
import { useState } from 'react'
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

  it('exposes the appropriate dialog semantics', () => {
    render(
      <Modal open onClose={vi.fn()} title="Edit booking">
        <p>Modal body</p>
      </Modal>
    )
    const dialog = screen.getByRole('dialog', { name: 'Edit booking' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('moves focus into the dialog when opened', () => {
    render(
      <Modal open onClose={vi.fn()} title="Edit booking">
        <button>Save</button>
      </Modal>
    )
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Edit booking">
        <button>Save</button>
      </Modal>
    )
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps Tab within the dialog, wrapping at both ends', async () => {
    const user = userEvent.setup()
    render(
      <Modal open onClose={vi.fn()} title="Edit booking">
        <button id="first">First</button>
        <button id="last">Last</button>
      </Modal>
    )
    const close = screen.getByRole('button', { name: 'Close' })
    const first = screen.getByRole('button', { name: 'First' })
    const last = screen.getByRole('button', { name: 'Last' })

    close.focus()
    await user.tab()
    expect(first).toHaveFocus()
    await user.tab()
    expect(last).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(last).toHaveFocus()
    await user.tab({ shift: true })
    expect(first).toHaveFocus()
    await user.tab({ shift: true })
    expect(close).toHaveFocus()
  })

  it('restores focus to the trigger element on close', async () => {
    const user = userEvent.setup()

    function DialogHarness({ children }: { children: ReactNode }) {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open dialog</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Edit booking">
            {children}
          </Modal>
        </>
      )
    }

    render(
      <DialogHarness>
        <button>Save</button>
      </DialogHarness>
    )

    const trigger = screen.getByRole('button', { name: 'Open dialog' })
    trigger.focus()
    await user.click(trigger)

    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(close).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
