'use client'

/**
 * The services' categories in My Resources: Layer 2 of the two (the team's
 * notes, October 2026: "Categories in My Resources should be 2 layered;
 * Layer 1 as Service, Post or Store Item, Layer 2 as layers in each"). Layer
 * 1 is on the page (app/my-resources/page.tsx); shop items and Tidbits have
 * their own categories there (KeptItems).
 *
 * Categories are derived from the user's saved items, so a chip never
 * returns zero results.
 */

export type ResourceGroup = 'all' | 'service' | 'store'

// Which ServiceHub categories are things you BUY rather than engage with.
// Everything else is a service post; 'other' stays with services because an
// uncategorised listing is far more often a service than a purchase.
const STORE_CATEGORIES = new Set(['store', 'app', 'book'])

export function groupForCategory(category: string): Exclude<ResourceGroup, 'all'> {
  return STORE_CATEGORIES.has((category || '').toLowerCase()) ? 'store' : 'service'
}

interface CategoryFilterProps {
  categories: string[]
  group: ResourceGroup
  category: string | null
  onGroupChange: (group: ResourceGroup) => void
  onCategoryChange: (category: string | null) => void
}

export default function CategoryFilter({
  categories,
  group,
  category,
  onGroupChange,
  onCategoryChange,
}: CategoryFilterProps) {
  if (categories.length === 0) return null

  const layerTwo =
    group === 'all' ? categories : categories.filter((c) => groupForCategory(c) === group)

  const pill = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`

  return (
    <div className="flex flex-col gap-2">
      {/* Layer 1 (Services, Posts or Store Items) is above the tab, on
          the page; this is Layer 2, the services' own categories. */}
      {/* Layer 2 — which category within that kind */}
      {layerTwo.length > 0 && (
        <div role="group" aria-label="Category" className="flex flex-wrap gap-2 pl-1 border-l-2 border-gray-200 ml-1">
          <button
            onClick={() => onCategoryChange(null)}
            className={`ml-2 ${pill(category === null)}`}
          >
            All Categories
          </button>
          {layerTwo.map((c) => (
            <button
              key={c}
              onClick={() => onCategoryChange(c)}
              className={`capitalize ${pill(category === c)}`}
            >
              {c.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
