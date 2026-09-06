// Retry helper for transient network failures. Only retries connection-level
// errors (fetch failures / timeouts) — never HTTP/RLS-denied errors, which
// must surface immediately and visibly.

export interface WithRetryOptions {
  attempts?: number
  delays?: number[]
  shouldRetry?: (error: unknown) => boolean
}

const DEFAULT_DELAYS = [500, 1500, 4000]

const TRANSIENT_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /load failed/i,
  /network\s*error/i,
  /network request failed/i,
  /timeout/i,
  /timed out/i,
  /aborted/i,
  /request aborted/i,
  /connection (?:was )?reset/i,
  /err_internet_disconnected/i,
  /socket hang up/i,
]

export function isTransientNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(message))
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withRetry<T>(fn: () => PromiseLike<T>, options: WithRetryOptions = {}): Promise<T> {
  const { attempts = 3, delays = DEFAULT_DELAYS, shouldRetry = isTransientNetworkError } = options

  let attempt = 0
  while (attempt < attempts) {
    try {
      return await fn()
    } catch (error) {
      attempt += 1
      if (attempt >= attempts || !shouldRetry(error)) throw error
      const delay = delays[attempt - 1] ?? delays[delays.length - 1] ?? 500
      await sleep(delay)
    }
  }
  throw new Error('withRetry exhausted its attempts without a result')
}