import {
  BookOpen, Shirt, Palette, Apple, HeartPulse, Package, ToyBrick,
  Smartphone, Grid3x3, type LucideIcon,
} from 'lucide-react'

/**
 * Shop category vocabulary, with an icon each (Odosa: "give all the filters
 * icons to the left, like the top navbar").
 *
 * Product vocabulary, not user content — the same class of constant as the
 * navbar labels themselves. An unknown category still renders, with a neutral
 * icon, so adding one to the database never leaves a filter chip blank.
 */

export interface ShopCategory {
  id: string
  label: string
  icon: LucideIcon
}

export const SHOP_CATEGORIES: ShopCategory[] = [
  { id: 'books',     label: 'Books',            icon: BookOpen },
  { id: 'clothing',  label: 'Clothing',         icon: Shirt },
  { id: 'crafts',    label: 'Crafts',           icon: Palette },
  { id: 'food',      label: 'Food',             icon: Apple },
  { id: 'self-care', label: 'Self-Care',        icon: HeartPulse },
  { id: 'supplies',  label: 'Supplies',         icon: Package },
  { id: 'toys',      label: 'Toys',             icon: ToyBrick },
  // Odosa: "Add an 'Apps & Programs' section". Distinct from the rest because
  // you do not have one shipped to you — it is downloaded, which is why the
  // retailer list below differs for it.
  { id: 'apps',      label: 'Apps & Programs',  icon: Smartphone },
]

const BY_ID = new Map(SHOP_CATEGORIES.map((c) => [c.id, c]))

export function shopCategory(id: string): ShopCategory {
  return (
    BY_ID.get((id || '').toLowerCase()) || {
      id,
      // Categories arrive from the database, so one we have never seen must
      // still render rather than producing a chip with no label or icon.
      label: (id || 'Other').replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: Grid3x3,
    }
  )
}

/** True for things you download rather than have delivered. */
export function isAppCategory(category: string): boolean {
  return (category || '').toLowerCase() === 'apps'
}
