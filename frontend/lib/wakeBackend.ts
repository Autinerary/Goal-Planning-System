/**
 * Wake the backend before it is needed.
 *
 * The backend sleeps when idle, and on 5 October 2026 its first answer took
 * 41 s. The path is made at the end of setup, so someone arriving while it
 * slept waited for the wake-up as well as the generation, and the browser
 * gave up after 20 s and asked again, which ran two generations at once and
 * hit the per-minute AI limit (Riipen Labs Group 9 saw setup "freeze";
 * backend/core/jobs.py, in_flight_for_user). Asking for /health as soon as
 * sign-up, sign-in or setup opens wakes it while people read and answer.
 *
 * Fire and forget, once per page load. The answer is not needed, so the
 * request is no-cors and carries no cookies.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

let asked = false

export function wakeBackend(): void {
  if (asked || typeof window === 'undefined') return
  asked = true
  try {
    fetch(`${API_URL}/health`, { mode: 'no-cors', cache: 'no-store' }).catch(() => {})
  } catch {}
}
