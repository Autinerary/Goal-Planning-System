/**
 * Wait times (the 5Qs report, October 2026: "Waittime is a universal bug
 * (solution MUST be highlighted in SHub!!!)"). People say how long they
 * waited when they rate a service; a service says its own wait in its
 * Resource Account. STEP 83 keeps both on each listing (wait_reported, the
 * middle answer of the last two years; wait_stated, with its date). The app
 * keeps the same words (frontend/lib/listings.ts).
 */
export const WAIT_BUCKETS = [
  { id: 'no_wait', label: 'No wait', short: 'No wait' },
  { id: 'under_1_month', label: 'Under a month', short: 'Under a month' },
  { id: '1_3_months', label: '1 to 3 months', short: '1–3 months' },
  { id: '3_6_months', label: '3 to 6 months', short: '3–6 months' },
  { id: '6_12_months', label: '6 to 12 months', short: '6–12 months' },
  { id: 'over_1_year', label: 'Over a year', short: 'Over a year' },
] as const

export type WaitBucket = (typeof WAIT_BUCKETS)[number]['id']

export const isWaitBucket = (v: unknown): v is WaitBucket => WAIT_BUCKETS.some((w) => w.id === v)

export const waitLabel = (v: string | null | undefined) => WAIT_BUCKETS.find((w) => w.id === v)?.label ?? null

/** Waits of a month or less: the "Short wait" filter. */
export const SHORT_WAITS: WaitBucket[] = ['no_wait', 'under_1_month']
