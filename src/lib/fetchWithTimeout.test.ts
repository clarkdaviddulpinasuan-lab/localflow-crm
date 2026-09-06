import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'

// Stand-in for a real fetch whose request never completes: only settles when
// the caller's signal fires, mirroring how a hung connection behaves.
function hangingFetch() {
  return vi.fn(
    (_input: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(init.signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError')),
          { once: true }
        )
      })
  )
}

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('aborts a request that never completes and surfaces the timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingFetch())

    const promise = fetchWithTimeout(1000)('https://example.test')

    const rejection = expect(promise).rejects.toMatchObject({ name: 'TimeoutError', message: 'Request timed out' })
    await vi.advanceTimersByTimeAsync(1000)
    await rejection
  })

  it('forwards an external abort immediately instead of waiting for the timer', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', hangingFetch())

    const external = new AbortController()
    const promise = fetchWithTimeout(5000)('https://example.test', { signal: external.signal })

    const rejection = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    external.abort()
    await rejection
  })

  it('resolves and stops its timer when the request completes in time', async () => {
    vi.useFakeTimers()
    const underlying = vi.fn(async () => ({ ok: true, status: 200 } as unknown as Response))
    vi.stubGlobal('fetch', underlying)

    const res = await fetchWithTimeout(5000)('https://example.test')
    expect(res).toMatchObject({ ok: true })
    expect(underlying).toHaveBeenCalledTimes(1)

    // Advancing well past the deadline afterwards must not re-abort anything.
    await vi.advanceTimersByTimeAsync(10_000)
    expect(underlying).toHaveBeenCalledTimes(1)
  })

  it('passes through untouched for a non-positive timeout', async () => {
    const underlying = vi.fn(async () => ({ ok: true } as unknown as Response))
    vi.stubGlobal('fetch', underlying)

    const res = await fetchWithTimeout(0)('https://example.test')
    expect(res).toMatchObject({ ok: true })
    expect(underlying).toHaveBeenCalledWith('https://example.test', undefined)
  })
})