/**
 * A short-lived, in-memory cache for search work that is the same for
 * everyone: which venues match a set of filters, a text query's semantic
 * matches, matching products. Nothing personal goes in it; distance from the
 * person, for example, is worked out after.
 *
 * Why: under load (docs/reports/load-test-2026-10-04.md) search slowed first,
 * because every search re-ran the same heavy queries. Each server instance now
 * keeps a result for `ttlMs`, and identical searches that arrive while one is
 * still running wait for it instead of starting their own.
 *
 * Per instance, so it never outlives a deploy; `maxEntries` bounds memory
 * (oldest out first). A result is dropped if it failed, or if the work called
 * `dontKeep()` because it could only complete partially.
 */

interface Entry<T> {
  value: Promise<T>
  expires: number
}

export function sharedCache<T>({ ttlMs, maxEntries }: { ttlMs: number; maxEntries: number }) {
  const entries = new Map<string, Entry<T>>()

  const forget = (key: string, value: Promise<T>) => {
    if (entries.get(key)?.value === value) entries.delete(key)
  }

  return function get(key: string, compute: (dontKeep: () => void) => Promise<T>): Promise<T> {
    const now = Date.now()
    const hit = entries.get(key)
    if (hit && hit.expires > now) {
      // Most recently used goes to the back, so the oldest is evicted first.
      entries.delete(key)
      entries.set(key, hit)
      return hit.value
    }

    let keep = true
    const value = compute(() => {
      keep = false
    })
    entries.set(key, { value, expires: now + ttlMs })
    value.then(
      () => {
        if (!keep) forget(key, value)
      },
      () => forget(key, value)
    )
    while (entries.size > maxEntries) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) break
      entries.delete(oldest)
    }
    return value
  }
}

/** A cache key that does not depend on property order. */
export function cacheKey(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v
  )
}
