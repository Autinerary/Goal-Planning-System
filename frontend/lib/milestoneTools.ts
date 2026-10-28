/**
 * The tools recommended for one milestone (the team's notes on the Milestone
 * view, October 2026): "Wishlist", "Currently Using" and "Used", where
 * clicking the chosen one again clears it; "How well did it help" only once
 * it is "Used", and for that tool alone; remove a tool; "recommend more"
 * until the milestone has 5 ("max resources for this milestone reached");
 * and "View in ResourceHub" instead of the service's own site.
 *
 * Statuses are ResourceHub's own (saved_resources.status: 'wishlist',
 * 'current', and 'past', which it shows as "Completed"), so they show there
 * too, and "Used" counts as experience for rating there (can_rate(), STEP 79).
 */

export type ToolStatus = 'wishlist' | 'current' | 'past'

export const STATUS_OPTIONS: ReadonlyArray<{ id: ToolStatus; label: string }> = [
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'current', label: 'Currently Using' },
  { id: 'past', label: 'Used' },
]

export const isToolStatus = (v: unknown): v is ToolStatus => v === 'wishlist' || v === 'current' || v === 'past'

/** The most tools one milestone shows. */
export const MAX_TOOLS = 5

export const MAX_REACHED = 'Max resources for this milestone reached'

export interface PlanTool {
  /** The agent's id, e.g. "sh_<uuid>" for a ResourceHub resource. */
  id: string
  /** The ResourceHub resource, when the tool is one. */
  resourceId?: string | null
  name: string
  description?: string
  /** service | product | commentary | other */
  type?: string
  url?: string
  rating?: number | null
  reviews?: number
  price?: number | string | null
  costType?: string | null
  category?: string | null
  helpsWith?: { category: string; points: string[] }[]
  /** Added with "Recommend more". */
  added?: boolean
}

const SELF_NAME = /^\s*(autinerary|resource\s*hub|service\s*hub)\b/i

/** Free, then by price, then paid with no price, then unknown (the agent's cost_order). */
function costRank(t: Pick<PlanTool, 'price' | 'costType'>): [number, number] {
  const price = Number(t.price)
  if (t.costType === 'free' || (t.price !== null && t.price !== undefined && t.price !== '' && price === 0)) return [0, 0]
  if (Number.isFinite(price) && price > 0) return [1, price]
  if (t.costType === 'paid') return [2, 0]
  return [3, 0]
}

/**
 * The plan's recommendations for one milestone (tool_recommendation's
 * `recommendations[milestoneId]`), as the pages and the server both read
 * them: free first, then the cheapest; plans made before the agent ordered
 * them that way get the same order. Ties keep the agent's order.
 */
export function toolsFromRecs(recs: unknown): PlanTool[] {
  return (Array.isArray(recs) ? recs : [])
    // Never Autinerary's or ResourceHub's own listing: the agent leaves it
    // out now (is_self_listing), and plans made before still hold it.
    .filter((t: any) => t && typeof t === 'object' && t.name && !SELF_NAME.test(String(t.name)))
    .map((t: any, i: number): PlanTool => ({
      id: String(t.id || `t${i}`),
      resourceId: t.resourceId || null,
      name: String(t.name),
      description: t.description || '',
      type: t.type === 'service' || t.type === 'commentary' || t.type === 'product' ? t.type : 'other',
      url: t.url,
      rating: typeof t.rating === 'number' ? t.rating : null,
      reviews: typeof t.reviews === 'number' ? t.reviews : 0,
      price: t.price ?? null,
      costType: t.costType ?? null,
      category: t.category ?? null,
      helpsWith: Array.isArray(t.helpsWith) ? t.helpsWith : undefined,
    }))
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const [ga, pa] = costRank(a.t)
      const [gb, pb] = costRank(b.t)
      return ga - gb || pa - pb || a.i - b.i
    })
    .map(({ t }) => t)
}

/** What the person changed about a milestone's list (kept in the plan: payload.toolEdits). */
export interface ToolEdits {
  removed: string[]
  added: PlanTool[]
}

export const NO_EDITS: ToolEdits = { removed: [], added: [] }

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

/** The ResourceHub resource a tool is, from its id ("sh_<uuid>") or a /resources/<uuid> link. */
export function resourceIdOf(tool: Pick<PlanTool, 'id' | 'resourceId' | 'url'>): string | null {
  if (tool.resourceId && UUID.test(tool.resourceId)) return tool.resourceId
  const fromId = tool.id?.startsWith('sh_') ? tool.id.slice(3) : ''
  if (UUID.test(fromId) && fromId.length === 36) return fromId
  const m = (tool.url || '').match(new RegExp(`/resources/(${UUID.source})`, 'i'))
  return m ? m[1] : null
}

/** One key per tool for its status, rating and removal: the resource when it is one. */
export const toolKey = (tool: Pick<PlanTool, 'id' | 'resourceId' | 'url'>): string => resourceIdOf(tool) || tool.id

/** Clicking a status: the one already chosen clears it; another replaces it. */
export function nextStatus(current: ToolStatus | null | undefined, clicked: ToolStatus): ToolStatus | null {
  return current === clicked ? null : clicked
}

/** Rating is asked only once the tool has been used. */
export const canRate = (status: ToolStatus | null | undefined): boolean => status === 'past'

/** Clean the stored edits (they come back from JSON). */
export function cleanEdits(raw: unknown): ToolEdits {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<ToolEdits>
  const removed = Array.isArray(r.removed) ? r.removed.filter((x): x is string => typeof x === 'string').slice(0, 100) : []
  const added = Array.isArray(r.added)
    ? r.added.filter((t): t is PlanTool => !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string').slice(0, MAX_TOOLS)
    : []
  return { removed, added }
}

/**
 * The list shown: the plan's first five (free first, as the agent ordered
 * them), less any removed, then any added with "Recommend more"; never more
 * than five, and each tool once.
 */
/**
 * A plan's tools without the listings ResourceHub has taken down. A tool is hidden only when its listing was checked
 * and is no longer approved (rejected or removed): a tool that isn't a ResourceHub listing, or a listing not checked
 * yet (or whose check failed), stays. On 22 October 2026, 54 plans still showed listings rejected on 22 September.
 */
export function stillListed<T extends Pick<PlanTool, 'id' | 'resourceId' | 'url'>>(
  tools: readonly T[],
  checked: ReadonlySet<string>,
  listed: ReadonlySet<string>,
): T[] {
  return tools.filter((t) => {
    const id = resourceIdOf(t)
    return !id || !checked.has(id) || listed.has(id)
  })
}

export function visibleTools(base: readonly PlanTool[], edits: ToolEdits = NO_EDITS, max = MAX_TOOLS): PlanTool[] {
  const removed = new Set(edits.removed)
  const seen = new Set<string>()
  const out: PlanTool[] = []
  for (const tool of [...base.slice(0, max), ...edits.added.map((t) => ({ ...t, added: true }))]) {
    const key = toolKey(tool)
    if (removed.has(key) || seen.has(key)) continue
    seen.add(key)
    out.push(tool)
    if (out.length >= max) break
  }
  return out
}

/** Keys not to suggest again for a milestone: shown, removed, or already suggested. */
export function excludedKeys(base: readonly PlanTool[], edits: ToolEdits): Set<string> {
  return new Set([...visibleTools(base, edits).map(toolKey), ...edits.removed, ...edits.added.map(toolKey)])
}

/** The edits after removing a tool (it may be one added earlier). */
export function withRemoved(edits: ToolEdits, key: string): ToolEdits {
  return {
    removed: edits.removed.includes(key) ? edits.removed : [...edits.removed, key],
    added: edits.added.filter((t) => toolKey(t) !== key),
  }
}

/** The edits after putting a removed tool back. */
export function withRestored(edits: ToolEdits, key: string): ToolEdits {
  return { ...edits, removed: edits.removed.filter((k) => k !== key) }
}

/** The edits after "Recommend more" found one; unchanged when the list is full. */
export function withAdded(base: readonly PlanTool[], edits: ToolEdits, tool: PlanTool): ToolEdits {
  if (visibleTools(base, edits).length >= MAX_TOOLS) return edits
  const key = toolKey(tool)
  return { removed: edits.removed.filter((k) => k !== key), added: [...edits.added.filter((t) => toolKey(t) !== key), { ...tool, added: true }] }
}

/** Where "View in ResourceHub" goes: the resource's page there, or a search for it. */
export function hubPath(tool: Pick<PlanTool, 'id' | 'resourceId' | 'url' | 'name'>): string {
  const id = resourceIdOf(tool)
  return id ? `/resources/${id}` : `/search?${new URLSearchParams({ q: tool.name })}`
}

/** "View these resources & more in ResourceHub": a search for what the milestone is about. */
export function hubSearchPath(milestoneName: string): string {
  const words = milestoneName
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(' ')
  return words ? `/search?${new URLSearchParams({ q: words })}` : '/search'
}

/** "Free", a price, or nothing when the listing doesn't say. */
export function costLabel(tool: Pick<PlanTool, 'price' | 'costType'>): string | null {
  const price = Number(tool.price)
  if (tool.costType === 'free' || (tool.price !== null && tool.price !== undefined && tool.price !== '' && price === 0)) return 'Free'
  if (Number.isFinite(price) && price > 0) return `$${price.toFixed(2)}`
  if (tool.costType === 'paid') return 'Paid'
  return null
}
