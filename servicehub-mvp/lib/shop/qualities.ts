import taxonomy from './taxonomy.json'
import { groupOfCategory } from './categories'

/**
 * The quality list (the team's planning note, products round, Goal 4: "a list
 * of specific qualities of each item ... must be qualities that users with
 * norms NEED"), from lib/shop/taxonomy.json. A quality belongs to the groups
 * it makes sense for ('*' is every group); core qualities are the shop's
 * filters. Each product's qualities were checked on its maker's or seller's
 * own pages.
 */

export interface Quality {
  id: string
  label: string
  groups: string[]
  core: boolean
  help: string
}

export interface QualityValue {
  id: string
  label: string
  unit: string
  groups: string[]
}

export const QUALITIES: Quality[] = taxonomy.qualities
export const QUALITY_VALUES: QualityValue[] = taxonomy.values

const BY_ID = new Map(QUALITIES.map((q) => [q.id, q]))
const VALUE_BY_ID = new Map(QUALITY_VALUES.map((v) => [v.id, v]))

export const quality = (id: string) => BY_ID.get(id) || null
export const qualityLabel = (id: string) => BY_ID.get(id)?.label || id.replace(/_/g, ' ')

const inGroup = (q: { groups: string[] }, group: string) => q.groups.includes('*') || q.groups.includes(group)

/** The qualities for a group (all of them, or the core ones for filtering). */
export function qualitiesForGroup(group: string, coreOnly = false): Quality[] {
  return QUALITIES.filter((q) => inGroup(q, group) && (!coreOnly || q.core))
}

/** The core qualities that apply everywhere ("Sold in Canada", "Made for adults"...). */
export const SHARED_CORE = QUALITIES.filter((q) => q.groups.includes('*') && q.core)

/** Only the qualities that make sense for a category, in the list's order. */
export function qualitiesOf(category: string, ids: string[]): Quality[] {
  const group = groupOfCategory(category)
  const set = new Set(ids || [])
  return QUALITIES.filter((q) => set.has(q.id) && (inGroup(q, group) || group === 'other'))
}

/** "Noise reduction: 27 dB", for a product's quality values. */
export function valueLines(values: Record<string, unknown> | null | undefined): { id: string; label: string; text: string }[] {
  return Object.entries(values || {})
    .map(([id, v]) => {
      const def = VALUE_BY_ID.get(id)
      const text = String(v ?? '').trim()
      if (!def || !text) return null
      return { id, label: def.label, text: def.unit && !text.endsWith(def.unit) ? `${text} ${def.unit}` : text }
    })
    .filter(Boolean) as { id: string; label: string; text: string }[]
}

export const isQuality = (id: unknown) => typeof id === 'string' && BY_ID.has(id)
