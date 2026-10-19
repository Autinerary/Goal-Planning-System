import {
  Apple, ShieldAlert, Shirt, Droplets, HeartPulse, Ear, BookOpen, Clapperboard,
  Smartphone, Home, Puzzle, Grid3x3, type LucideIcon,
} from 'lucide-react'
import taxonomy from './taxonomy.json'

/**
 * The shop's categories (the team's planning note, products round, October
 * 2026, Goal 3: "come up with general categories ... up to 40"): 40
 * categories in 11 groups, from lib/shop/taxonomy.json, with an icon for each
 * group (Odosa: "give all the filters icons to the left"). The categories
 * products had before (books, clothing, crafts...) still work: each maps to
 * one of the 40 (taxonomy.json "legacy"). An unknown category still renders,
 * with a neutral icon.
 */

export interface ShopGroup {
  id: string
  label: string
  description: string
  icon: LucideIcon
}

export interface ShopCategory {
  id: string
  label: string
  group: string
  icon: LucideIcon
}

const GROUP_ICONS: Record<string, LucideIcon> = {
  food: Apple,
  allergies: ShieldAlert,
  clothes: Shirt,
  'sensitive-skin': Droplets,
  'self-care': HeartPulse,
  sensory: Ear,
  books: BookOpen,
  movies: Clapperboard,
  apps: Smartphone,
  'home-safety': Home,
  'play-school': Puzzle,
}

export const SHOP_GROUPS: ShopGroup[] = taxonomy.groups.map((g) => ({ ...g, icon: GROUP_ICONS[g.id] || Grid3x3 }))
export const SHOP_CATEGORIES: ShopCategory[] = taxonomy.categories.map((c) => ({ ...c, icon: GROUP_ICONS[c.group] || Grid3x3 }))

const LEGACY = taxonomy.legacy as Record<string, string>
const BY_ID = new Map(SHOP_CATEGORIES.map((c) => [c.id, c]))
const GROUP_BY_ID = new Map(SHOP_GROUPS.map((g) => [g.id, g]))

/** One of the 40 ids, for a category or an older one (books -> books-guides). */
export function canonicalCategory(id: string | null | undefined): string {
  const k = (id || '').trim().toLowerCase()
  return BY_ID.has(k) ? k : LEGACY[k] || k
}

export function shopCategory(id: string): ShopCategory {
  const c = BY_ID.get(canonicalCategory(id))
  if (c) return c
  return {
    id,
    // Categories arrive from the database, so one we have never seen must
    // still render rather than producing a chip with no label or icon.
    label: (id || 'Other').replace(/[-_]/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
    group: 'other',
    icon: Grid3x3,
  }
}

export function shopGroup(id: string): ShopGroup | null {
  return GROUP_BY_ID.get(id) || null
}

export const groupOfCategory = (id: string) => shopCategory(id).group

/** A group's category ids, with the older ids that now belong to it. */
export function categoriesOfGroup(group: string): string[] {
  const ids = SHOP_CATEGORIES.filter((c) => c.group === group).map((c) => c.id)
  const legacy = Object.entries(LEGACY).filter(([, to]) => ids.includes(to)).map(([from]) => from)
  return [...ids, ...legacy]
}

/** Group or category ids (from a filter) as every category id they cover, older ones included. */
export function expandShopFilter(ids: string[]): string[] {
  const out = new Set<string>()
  for (const raw of ids) {
    const id = (raw || '').trim().toLowerCase()
    if (GROUP_BY_ID.has(id)) categoriesOfGroup(id).forEach((c) => out.add(c))
    else if (BY_ID.has(id) || LEGACY[id]) {
      const canon = canonicalCategory(id)
      out.add(canon)
      Object.entries(LEGACY).forEach(([from, to]) => to === canon && out.add(from))
    }
  }
  return Array.from(out)
}

/** Whether a filter value is a shop group or category (search's "did they ask for products?"). */
export const isShopFilterId = (id: string) => {
  const k = (id || '').trim().toLowerCase()
  return GROUP_BY_ID.has(k) || BY_ID.has(k) || Boolean(LEGACY[k])
}

/** True for things you download rather than have delivered. */
export function isAppCategory(category: string): boolean {
  return groupOfCategory(category) === 'apps'
}

/** True for films and series: watched, not bought. */
export function isWatchCategory(category: string): boolean {
  return groupOfCategory(category) === 'movies'
}
