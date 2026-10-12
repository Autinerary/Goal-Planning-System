/**
 * The pages visited in this tab, so a Back button knows whether there is a
 * page in the app to go back to (Riipen Labs, Group 31: Back "doesn't
 * directly take users back to the main homepage, and instead reloads their
 * last action"). A change within a page (its ?view=, a tab) is not a new
 * page. Opened from an email or a new tab, there is no earlier page, and
 * Back goes to the Path. Kept in sessionStorage: one tab, gone when closed.
 */
const KEY = 'autinerary_trail'
const MAX = 30

function read(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Record arriving on a page: going back pops the page left; a new page is added. */
export function recordPage(pathname: string): void {
  const trail = read()
  if (trail[trail.length - 1] === pathname) return
  if (trail[trail.length - 2] === pathname) trail.pop()
  else trail.push(pathname)
  try { sessionStorage.setItem(KEY, JSON.stringify(trail.slice(-MAX))) } catch {}
}

/** The page before this one in the app, or null if this is the first. */
export function previousPage(): string | null {
  const trail = read()
  return trail.length >= 2 ? trail[trail.length - 2] : null
}
