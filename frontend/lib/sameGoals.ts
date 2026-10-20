/**
 * Whether two goals are alike, for "your people on the same goals" (Hare
 * World's Person's Icon @ Goal): one contains the other, or they share at
 * least half their words, leaving out small ones.
 */
const SMALL = new Set(['a', 'an', 'the', 'to', 'of', 'and', 'or', 'for', 'in', 'on', 'my', 'get', 'be', 'with', 'at', 'by', 'more', 'some'])
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !SMALL.has(w)))

export function alike(a: string, b: string): boolean {
  const x = a.toLowerCase().trim()
  const y = b.toLowerCase().trim()
  if (!x || !y) return false
  if (x.includes(y) || y.includes(x)) return true
  const wa = words(a)
  const wb = words(b)
  if (!wa.size || !wb.size) return false
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / Math.min(wa.size, wb.size) >= 0.5
}

/** The goal names in a saved plan: its goals and its races, as the Races page reads them. */
export function goalsOf(payload: any): string[] {
  const out = new Set<string>()
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) out.add(v.trim().slice(0, 140))
  }
  const p = payload || {}
  for (const g of p.userProfile?.goals || p.goals || []) add(typeof g === 'string' ? g : g?.name || g?.title)
  for (const r of p.races || p.pathPlanning?.races || []) add(r?.name || r?.goal)
  return Array.from(out).slice(0, 30)
}
