// App movement / route-order tracker.
//
// Records the order in which a user moves through the app's screens during a
// session. This answers Liam's question ("what order did they go through the
// app?") without a manual form — we capture it automatically and can surface
// or export it for research.
//
// Stored in localStorage as an append-only list of visits. Kept lightweight:
// path + human label + timestamp. No PII beyond the in-app route.

export interface RouteVisit {
  path: string
  label: string
  at: string // ISO timestamp
}

const LS_KEY = 'autinerary_movement'
const MAX_VISITS = 500

// Map known routes to friendly labels for readable reports.
const LABELS: { test: RegExp; label: string }[] = [
  { test: /^\/$/, label: 'Home' },
  { test: /^\/login/, label: 'Login' },
  { test: /^\/signup/, label: 'Sign up' },
  { test: /^\/onboarding-confirmation/, label: 'Onboarding Confirmation' },
  { test: /^\/onboarding/, label: 'Onboarding' },
  { test: /^\/path/, label: 'Path' },
  { test: /^\/races/, label: 'Races' },
  { test: /^\/milestones\/[^/]+/, label: 'Milestone Detail' },
  { test: /^\/milestones/, label: 'Milestones' },
  { test: /^\/tasks\/[^/]+/, label: 'Task Detail' },
  { test: /^\/tasks/, label: 'Tasks' },
  { test: /^\/calendar/, label: 'Calendar' },
  { test: /^\/pit-stop/, label: 'Pit Stop' },
  { test: /^\/reflection\/history/, label: 'All Entries' },
  { test: /^\/reflection/, label: 'Journal' },
  { test: /^\/stats/, label: 'Stats' },
  { test: /^\/tools/, label: 'Tools' },
  { test: /^\/ideal-self/, label: 'Ideal Self' },
  { test: /^\/resource-roadmap/, label: 'Resource Roadmap' },
  { test: /^\/recommend-choices/, label: 'Recommend Choices' },
  { test: /^\/compare/, label: 'Compare' },
  { test: /^\/friend/, label: 'Friend' },
  { test: /^\/profile\/settings/, label: 'Settings' },
  { test: /^\/profile/, label: 'Profile' },
]

export function labelForPath(path: string): string {
  const base = path.split('?')[0]
  for (const { test, label } of LABELS) {
    if (test.test(base)) return label
  }
  // Fallback: first segment title-cased.
  const seg = base.split('/').filter(Boolean)[0] || 'Home'
  return seg.charAt(0).toUpperCase() + seg.slice(1)
}

export function loadMovement(): RouteVisit[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as RouteVisit[]) : []
  } catch {
    return []
  }
}

/**
 * Record a visit. Skips consecutive duplicates (e.g. a re-render on the same
 * path) so the order list stays meaningful.
 */
export function recordVisit(path: string): RouteVisit[] {
  if (typeof window === 'undefined') return []
  const list = loadMovement()
  const base = path.split('?')[0]
  const last = list[list.length - 1]
  if (last && last.path.split('?')[0] === base) return list
  const visit: RouteVisit = { path, label: labelForPath(path), at: new Date().toISOString() }
  const next = [...list, visit].slice(-MAX_VISITS)
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('autinerary:movement', { detail: next }))
  } catch {
    /* quota — ignore */
  }
  return next
}

export function clearMovement(): void {
  try {
    localStorage.removeItem(LS_KEY)
    window.dispatchEvent(new CustomEvent('autinerary:movement', { detail: [] }))
  } catch {
    /* ignore */
  }
}

/** A compact "A → B → C" summary of the movement order. */
export function movementSummary(list: RouteVisit[] = loadMovement()): string {
  return list.map((v) => v.label).join(' → ')
}

/** Export the movement log as a downloadable JSON blob. */
export function exportMovement(): void {
  const list = loadMovement()
  const blob = new Blob([JSON.stringify({ visits: list, summary: movementSummary(list) }, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `autinerary-movement-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
