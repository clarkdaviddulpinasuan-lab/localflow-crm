import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OfflineBanner } from '@/components/OfflineBanner'

function goOffline() {
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
}

function goOnline() {
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
}

describe('OfflineBanner', () => {
  it('is hidden while online', () => {
    render(<OfflineBanner />)
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()
  })

  it('appears when the connection drops and disappears when it returns', async () => {
    render(<OfflineBanner />)

    goOffline()
    expect(screen.getByText(/You're offline/)).toBeInTheDocument()

    goOnline()
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()
  })

  it('can be dismissed and reappears on the next offline episode', async () => {
    const user = userEvent.setup()
    render(<OfflineBanner />)

    goOffline()
    await user.click(screen.getByRole('button', { name: 'Dismiss offline notice' }))
    expect(screen.queryByText(/You're offline/)).not.toBeInTheDocument()

    goOnline()
    goOffline()
    expect(screen.getByText(/You're offline/)).toBeInTheDocument()
  })
})