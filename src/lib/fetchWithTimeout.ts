// Bound every request with a hard timeout. Browser fetch has no default
// timeout, so a connection that hangs (server up but never answering) would
// stall forever — and the retry helper in withRetry.ts can only retry failures
// that actually surface. This wraps the Supabase client's fetch with a
// timer-driven AbortController so a "hung" request fails loudly after
// `timeoutMs` instead of silently hanging.

export function fetchWithTimeout(timeoutMs = 15000): typeof fetch {
  return (input, init) => {
    if (timeoutMs <= 0) return fetch(input, init)

    const controller = new AbortController()
    const externalSignal = init?.signal

    const onExternalAbort = () => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', onExternalAbort)
    }

    const timer = setTimeout(() => {
      controller.abort(new DOMException('Request timed out', 'TimeoutError'))
    }, timeoutMs)

    const requestInit = init ? { ...init, signal: controller.signal } : { signal: controller.signal }

    return fetch(input, requestInit).finally(() => {
      clearTimeout(timer)
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
    })
  }
}