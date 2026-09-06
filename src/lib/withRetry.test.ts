import { describe, it, expect, vi } from 'vitest'
import { withRetry, isTransientNetworkError } from '@/lib/withRetry'

describe('isTransientNetworkError', () => {
  it('matches fetch/network/timeout failures', () => {
    expect(isTransientNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isTransientNetworkError(new Error('fetch failed'))).toBe(true)
    expect(isTransientNetworkError(new Error('NetworkError when attempting to fetch resource'))).toBe(true)
    expect(isTransientNetworkError(new Error('request timed out'))).toBe(true)
    expect(isTransientNetworkError(new Error('the connection was reset'))).toBe(true)
  })

  it('does not match RLS-denied or HTTP errors', () => {
    expect(isTransientNetworkError(new Error('new row violates row-level security policy for table "customers"'))).toBe(false)
    expect(isTransientNetworkError(new Error('Permission denied for table customers'))).toBe(false)
    expect(isTransientNetworkError(new Error('Invalid login credentials'))).toBe(false)
  })
})

describe('withRetry', () => {
  it('retries transient failures until success', async () => {
    let calls = 0
    const result = await withRetry(
      () => {
        calls += 1
        if (calls < 3) return Promise.reject(new Error('Failed to fetch'))
        return Promise.resolve('ok')
      },
      { attempts: 3, delays: [1, 2, 3] }
    )
    expect(result).toBe('ok')
    expect(calls).toBe(3)
  })

  it('fails after exhausting attempts', async () => {
    let calls = 0
    await expect(
      withRetry(
        () => {
          calls += 1
          return Promise.reject(new Error('Failed to fetch'))
        },
        { attempts: 3, delays: [1, 2, 3] }
      )
    ).rejects.toThrow('Failed to fetch')
    expect(calls).toBe(3)
  })

  it('does not retry non-transient errors', async () => {
    let calls = 0
    await expect(
      withRetry(() => {
        calls += 1
        return Promise.reject(new Error('new row violates row-level security policy'))
      })
    ).rejects.toThrow('row-level security')
    expect(calls).toBe(1)
  })

  it('honors a custom retry predicate', async () => {
    let calls = 0
    const fn = vi.fn(async () => {
      calls += 1
      if (calls < 3) throw new Error('custom transient')
      return 'done'
    })
    const result = await withRetry(fn, {
      attempts: 3,
      delays: [1],
      shouldRetry: (e) => (e as Error).message === 'custom transient',
    })
    expect(result).toBe('done')
    expect(calls).toBe(3)
  })
})