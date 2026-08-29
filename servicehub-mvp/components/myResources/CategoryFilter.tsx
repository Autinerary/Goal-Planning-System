'use client'

/**
 * Two-layer category filter (Odosa: "Categories in My Resources should be
 * 2 layered; Layer 1 as Service Post or Store Item, Layer 2 as layers in each
 * individual place").
 *
 * Layer 1 answers "is this something I engage with, or something I buy?" —
 * the distinction that actually changes what you do next. Layer 2 then shows
 * ONLY the categories that exist inside that group, so picking "Store Items"
 * cannot leave you looking at a Therapist filter that now matches nothing.
 *
 * Groups are derived from the categories actually present in the user's saved
 * items, so an empty group never renders a button that returns zero results.
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

const GROUP_LABEL: Record<Exclude<ResourceGroup, 'all'>, string> = {
  service: 'Service Posts',
  store: 'Store Items',
}

export default function CategoryFilter({
  categories,
  group,
  category,
  onGroupChange,
  onCategoryChange,
}: CategoryFilterProps) {
  if (categories.length === 0) return null

  const present = new Set(categories.map(groupForCategory))
  // Only offer a layer-1 button for a group the user actually has something in.
  const groups = (['service', 'store'] as const).filter((g) => present.has(g))

  const layerTwo =
    group === 'all' ? categories : categories.filter((c) => groupForCategory(c) === group)

  const pill = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`

  return (
    <div className="flex flex-col gap-2">
      {/* Layer 1 — what kind of thing */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            onGroupChange('all')
            onCategoryChange(null)
          }}
          className={pill(group === 'all')}
        >
          All
        </button>
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => {
              onGroupChange(g)
              // Clear a layer-2 choice that does not belong to the new group,
              // otherwise the list silently shows nothing.
              if (category && groupForCategory(category) !== g) onCategoryChange(null)
            }}
            className={pill(group === g)}
          >
            {GROUP_LABEL[g]}
          </button>
        ))}
      </div>

      {/* Layer 2 — which category within that kind */}
      {layerTwo.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-1 border-l-2 border-gray-200 ml-1">
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
