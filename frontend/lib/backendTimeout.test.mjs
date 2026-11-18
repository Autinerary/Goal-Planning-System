// Run from frontend/: node --experimental-strip-types lib/backendTimeout.test.mjs
import assert from 'node:assert/strict'
import { BACKEND_TIMEOUT_MS, TimeoutError, fetchWithTimeout, isTimeout } from './backendTimeout.ts'

// Generous: a cold start alone took over 60 s.
assert.ok(BACKEND_TIMEOUT_MS >= 75_000 && BACKEND_TIMEOUT_MS <= 90_000)

// Timeouts are recognised from ours, AbortSignal.timeout's and axios's; other failures are not.
assert.equal(isTimeout(new TimeoutError()), true)
assert.equal(isTimeout({ name: 'TimeoutError' }), true)
assert.equal(isTimeout({ code: 'ECONNABORTED' }), true)
assert.equal(isTimeout({ code: 'ETIMEDOUT' }), true)
assert.equal(isTimeout(new TypeError('Failed to fetch')), false)
assert.equal(isTimeout(null), false)

// A backend that never answers: fetchWithTimeout gives up with a TimeoutError.
const realFetch = globalThis.fetch
globalThis.fetch = (_url, init) => new Promise((_resolve, reject) => {
  init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
})
await assert.rejects(fetchWithTimeout('https://backend.invalid/slow', {}, 20), (e) => isTimeout(e) && e.name === 'TimeoutError')

// The caller's own signal still cancels it, and that is not a timeout.
const caller = new AbortController()
const cancelled = fetchWithTimeout('https://backend.invalid/slow', { signal: caller.signal }, 5_000)
caller.abort()
await assert.rejects(cancelled, (e) => e.name === 'AbortError' && !isTimeout(e))

// An answer in time comes through as it is.
globalThis.fetch = async () => new Response('{"ok":true}', { status: 200 })
const res = await fetchWithTimeout('https://backend.invalid/fast', {}, 1_000)
assert.equal(res.status, 200)
assert.deepEqual(await res.json(), { ok: true })

globalThis.fetch = realFetch
console.log('backendTimeout: ok')
