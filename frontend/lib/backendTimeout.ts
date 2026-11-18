/**
 * Calls to the backend that can't wait for ever (bug audit, 17 November 2026, item 36).
 *
 * The backend sleeps when nobody has used it for a while, and waking it took over 60 s on its own. A call made while
 * it slept had no limit, so a Save button could spin with no end. These calls now give up after BACKEND_TIMEOUT_MS,
 * long enough for a wake-up and the answer, and the page says it is taking longer than usual and to try again.
 */

/** Long enough for a cold start (60 s or more) and the answer. */
export const BACKEND_TIMEOUT_MS = 90_000

/** What a page says when the backend took too long. */
export const TAKING_LONGER = 'This is taking longer than usual. Please try again in a minute.'

/** Thrown by fetchWithTimeout when the time ran out (the name AbortSignal.timeout uses too). */
export class TimeoutError extends Error {
  constructor(message = TAKING_LONGER) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/** Whether an error is a timeout: fetchWithTimeout's, AbortSignal.timeout's, or axios's (ECONNABORTED, ETIMEDOUT). */
export function isTimeout(error: unknown): boolean {
  const e = error as { name?: unknown; code?: unknown } | null | undefined
  return e?.name === 'TimeoutError' || e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT'
}

/**
 * fetch that gives up after `ms` with a TimeoutError. A signal passed in still cancels it, as before. Made with
 * setTimeout rather than AbortSignal.timeout, which Safari before 16 doesn't have.
 */
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = BACKEND_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, ms)
  const outer = init.signal
  const stop = () => controller.abort()
  if (outer) {
    if (outer.aborted) controller.abort()
    else outer.addEventListener('abort', stop, { once: true })
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (timedOut) throw new TimeoutError()
    throw error
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', stop)
  }
}
