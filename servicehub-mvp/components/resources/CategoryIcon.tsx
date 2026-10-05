import {
  Baby, Brain, Briefcase, Building2, Bike, Globe, GraduationCap, HandHelping, HeartHandshake, Home,
  MapPin, Stethoscope, Trees, Users, Utensils, type LucideIcon,
} from 'lucide-react'
import { SHOP_CATEGORIES } from '@/lib/shop/categories'

/**
 * A recognisable icon for a place with no photo, by its category.
 *
 * Riipen Labs, Group 8: "Resource cards also rely on large two-letter
 * placeholders rather than recognizable icons or images." Only about 3% of
 * places have a photo, so most cards showed initials ("SC" for a school). A
 * calm tint with the category's icon says what the place is at a glance. A
 * real photo always wins (ResourceCard).
 */

const PLACE_ICONS: Record<string, LucideIcon> = {
  park: Trees,
  doctor: Stethoscope,
  school: GraduationCap,
  'community center': Building2,
  recreation: Bike,
  'senior care': HeartHandshake,
  'social services': HandHelping,
  therapist: Brain,
  shelter: Home,
  'food support': Utensils,
  'support group': Users,
  'supported housing': Home,
  employment: Briefcase,
  'child care': Baby,
  organization: Users,
}

const SHOP_ICONS: Record<string, LucideIcon> = Object.fromEntries(SHOP_CATEGORIES.map((c) => [c.id, c.icon]))

export function iconForCategory(category: string | null | undefined, online = false): LucideIcon {
  const key = (category || '').trim().toLowerCase()
  return PLACE_ICONS[key] || SHOP_ICONS[key] || (online ? Globe : MapPin)
}

// Soft tints, one per kind of place, so a page of cards stays calm.
const TINTS = [
  'bg-blue-50 text-blue-700',
  'bg-emerald-50 text-emerald-700',
  'bg-violet-50 text-violet-700',
  'bg-amber-50 text-amber-800',
  'bg-sky-50 text-sky-700',
  'bg-rose-50 text-rose-700',
]

export function tintForCategory(category: string | null | undefined): string {
  const key = (category || '').trim().toLowerCase()
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}

export default function CategoryIcon({
  category,
  online = false,
  size = 'md',
  className = '',
}: {
  category: string | null | undefined
  online?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const Icon = iconForCategory(category, online)
  const box = size === 'sm' ? 'h-10 w-10 rounded-lg' : size === 'lg' ? 'h-full w-full' : 'h-14 w-14 rounded-xl'
  const glyph = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-12 w-12' : 'h-7 w-7'
  return (
    <div className={`flex flex-shrink-0 items-center justify-center ${box} ${tintForCategory(category)} ${className}`} aria-hidden="true">
      <Icon className={glyph} strokeWidth={1.75} />
    </div>
  )
}
