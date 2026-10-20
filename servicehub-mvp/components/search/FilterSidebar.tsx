'use client'

import { useState, useEffect, useId } from 'react'
import Link from 'next/link'
import {
  CONNECTION_TYPES,
  AGE_RANGES,
  SPECIAL_TAGS,
  SOURCE_TYPE_GROUPS,
  TRENDING_FILTERS,
  TRENDING_TIERS,
  THERAPY_TYPES,
  THERAPY_SUBTYPES,
} from '@/lib/filters/taxonomy'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import ConditionsFilter from './ConditionsFilter'
import CostFilter from './CostFilter'
import RatingChipsFilter from './RatingChipsFilter'
import TagFilters from './TagFilters'
import LifeCategoryFilters from './LifeCategoryFilters'
import { FilterGroup, FilterSection } from './FilterSection'
import type { CostType } from '@/lib/filters/tags'
import { FILTER_NORM_GROUPS } from '@/lib/norms/taxonomy'
import { SHOP_GROUPS } from '@/lib/shop/categories'
import { ACTIVITIES } from '@/lib/search/keywordFilters'
import { CONDITION_GROUPS, decodeCondition } from '@/lib/search/conditions'

interface FilterSidebarProps {
  categories: string[]
  barriers: string[]
  conditions: string[]
  lifeAreas: string[]
  minRating?: number
  ratingStars: number[]
  minPrice?: number
  maxPrice?: number
  maxDistance?: number
  onCategoryToggle: (category: string) => void
  onBarrierToggle: (barrier: string) => void
  onLifeAreaToggle: (area: string) => void
  onConditionsChange: (next: string[]) => void
  onMinRatingChange: (rating: number | undefined) => void
  onRatingStarsChange: (next: number[]) => void
  onPriceChange: (next: { min?: number; max?: number }) => void
  onMaxDistanceChange: (distance: number | undefined) => void
  onClearFilters?: () => void
  // Odosa's three new groups. Optional so existing callers keep working
  // until they pass them.
  connectionTypes?: string[]
  ageRanges?: string[]
  specialTags?: string[]
  sourceTypes?: string[]
  onConnectionTypeToggle?: (id: string) => void
  onAgeRangeToggle?: (id: string) => void
  onSpecialTagToggle?: (id: string) => void
  onSourceTypeToggle?: (id: string) => void
  /** Activities (Swimming, Horseback Riding, Animal Therapy) and therapy
   *  kinds (the team's notes, October 2026; lib/search/keywordFilters.ts). */
  activities?: string[]
  therapy?: string[]
  onActivityToggle?: (id: string) => void
  onTherapyToggle?: (id: string) => void
  /** Where distances are measured from ("Surrey, BC"), and whether someone is
   *  signed in, so the distance filter can say so (Riipen Labs, Group 8). */
  place?: string | null
  signedIn?: boolean
  /** Tags, free or paid, online and the age of a service (the planning note, October 2026). */
  tags?: string[]
  costType?: CostType
  online?: boolean
  shortWait?: boolean
  onShortWaitChange?: (next: boolean) => void
  serviceAge?: string
  /** The person's country, for the school system in Education. */
  country?: string | null
  onTagToggle?: (id: string) => void
  onCostTypeChange?: (next: CostType | undefined) => void
  onOnlineChange?: (next: boolean) => void
  onServiceAgeChange?: (next: string | undefined) => void
}

const BOX = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded'
const ROW = 'flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded'

// The categories Activities covers: it finds them, and every other listing
// that offers the activity, so they aren't listed twice.
const UNDER_ACTIVITIES = new Set(['swimming', 'horseback riding'])
// "Therapist" is shown as "Therapy" (the team's notes, October 2026); the
// listings keep their category.
const THERAPY_CATEGORY = 'therapist'
// Personality is its own section, apart from norms.
const PERSONALITY = new Set(
  (CONDITION_GROUPS.find((g) => g.id === 'personality_disorders')?.groups || []).flatMap((g) => (g.conditions || []).map((c) => c.id))
)

/** A small open-and-close arrow beside a choice, for the choices under it. */
function Disclosure({ open, onToggle, controls, label }: { open: boolean; onToggle: () => void; controls: string; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      className="rounded p-1.5 text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {open ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}

/** Therapy, with its eight types from the Learning page and the kinds the page names under each. */
function TherapyChoices({
  category,
  checked,
  therapy,
  onCategoryToggle,
  onTherapyToggle,
}: {
  category: string
  checked: boolean
  therapy: string[]
  onCategoryToggle: (category: string) => void
  onTherapyToggle?: (id: string) => void
}) {
  const id = useId()
  const chosen = THERAPY_TYPES.filter((t) => therapy.includes(t.id) || (THERAPY_SUBTYPES[t.id] || []).some((s) => therapy.includes(s.id))).length
  const [open, setOpen] = useState(chosen > 0)
  const [openTypes, setOpenTypes] = useState<Set<string>>(
    () => new Set(THERAPY_TYPES.filter((t) => (THERAPY_SUBTYPES[t.id] || []).some((s) => therapy.includes(s.id))).map((t) => t.id))
  )
  const toggleType = (t: string) =>
    setOpenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  return (
    <div>
      <div className="flex items-center gap-1">
        <label className={`${ROW} flex-1`}>
          <input type="checkbox" checked={checked} onChange={() => onCategoryToggle(category)} className={BOX} />
          <span className="ml-2 text-sm text-gray-700">
            Therapy
            {chosen > 0 && <span className="ml-2 inline-flex items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-semibold text-white">{chosen}</span>}
          </span>
        </label>
        {onTherapyToggle && <Disclosure open={open} onToggle={() => setOpen(!open)} controls={id} label="Types of therapy" />}
      </div>
      {onTherapyToggle && (
        <div id={id} hidden={!open} className="ml-6 border-l-2 border-gray-200 pl-2">
          <p className="px-2 pt-1 text-xs text-gray-600">
            The types on our{' '}
            <a href="https://www.autinerary.ca/learning/general-service-info" target="_blank" rel="noopener noreferrer" className="underline">
              Autism Services page
            </a>
            .
          </p>
          {THERAPY_TYPES.map((t) => {
            const subs = THERAPY_SUBTYPES[t.id] || []
            const subId = `${id}-${t.id}`
            return (
              <div key={t.id}>
                <div className="flex items-center gap-1">
                  <label className={`${ROW} flex-1`}>
                    <input type="checkbox" checked={therapy.includes(t.id)} onChange={() => onTherapyToggle(t.id)} className={BOX} />
                    <span className="ml-2 text-sm text-gray-700">{t.label}</span>
                  </label>
                  {subs.length > 0 && (
                    <Disclosure open={openTypes.has(t.id)} onToggle={() => toggleType(t.id)} controls={subId} label={`Kinds of ${t.label.toLowerCase()} therapy`} />
                  )}
                </div>
                {subs.length > 0 && (
                  <div id={subId} hidden={!openTypes.has(t.id)} className="ml-6">
                    {subs.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 p-1 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={therapy.includes(s.id)} onChange={() => onTherapyToggle(s.id)} className={BOX} />
                        {s.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** A Special Tag as it looks on the cards (its gradient, metal and shine), pressed or not. */
function SpecialChip({ label, className, active, onClick }: { label: string; className: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-shadow ${className} ${
        active ? 'ring-2 ring-blue-700 ring-offset-2' : 'opacity-90 hover:opacity-100'
      }`}
    >
      {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </button>
  )
}

export default function FilterSidebar({
  connectionTypes: selectedConnectionTypes = [],
  ageRanges: selectedAgeRanges = [],
  specialTags: selectedSpecialTags = [],
  sourceTypes: selectedSourceTypes = [],
  onConnectionTypeToggle,
  onAgeRangeToggle,
  onSpecialTagToggle,
  onSourceTypeToggle,
  activities: selectedActivities = [],
  therapy: selectedTherapy = [],
  onActivityToggle,
  onTherapyToggle,
  categories: selectedCategories,
  barriers: selectedBarriers,
  conditions: selectedConditions,
  lifeAreas: selectedLifeAreas,
  minRating,
  ratingStars,
  minPrice,
  maxPrice,
  maxDistance,
  onCategoryToggle,
  onBarrierToggle,
  onLifeAreaToggle,
  onConditionsChange,
  onMinRatingChange,
  onRatingStarsChange,
  onPriceChange,
  onMaxDistanceChange,
  onClearFilters,
  place = null,
  signedIn = false,
  tags: selectedTags = [],
  costType,
  online = false,
  shortWait = false,
  onShortWaitChange,
  serviceAge,
  country = null,
  onTagToggle,
  onCostTypeChange,
  onOnlineChange,
  onServiceAgeChange,
}: FilterSidebarProps) {
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  // Odosa: "they are working; they're just not showing up like the other ones."
  // Every norm group starts open and each one opens and closes on its own.
  const [collapsedNormGroups, setCollapsedNormGroups] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/search/categories')
      .then((res) => res.json())
      .then(setAvailableCategories)
      .catch((err) => {
        console.error('Error fetching categories:', err)
        setAvailableCategories([])
      })
  }, [])

  const toggleBarrierCategory = (category: string) => {
    setCollapsedNormGroups((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const isChosen = (category: string) => selectedCategories.some((c) => c.toLowerCase() === category.toLowerCase())

  // One row per category whatever its case ("organization" and "Organization"
  // match the same listings); the ones under Activities only when chosen
  // from an older link, so they can be unticked.
  const placeCategories = (() => {
    const seen = new Map<string, string>()
    for (const c of availableCategories) {
      const key = c.toLowerCase()
      if (key === 'commentary') continue
      if (UNDER_ACTIVITIES.has(key) && !isChosen(c)) continue
      const kept = seen.get(key)
      // Prefer the capitalised spelling.
      if (!kept || (kept === kept.toLowerCase() && c !== c.toLowerCase())) seen.set(key, c)
    }
    return Array.from(seen.values())
  })()

  const shopIds = new Set<string>(SHOP_GROUPS.map((g) => g.id))
  const placesChosen = selectedCategories.filter((c) => !shopIds.has(c) && c.toLowerCase() !== 'commentary').length
  const shopChosen = selectedCategories.filter((c) => shopIds.has(c)).length
  const commentaryChosen = isChosen('commentary')
  const sourcesFor = (group: (typeof SOURCE_TYPE_GROUPS)[number]) => group.options.filter((o) => selectedSourceTypes.includes(o.id)).length
  const commentariesActive = (commentaryChosen ? 1 : 0) + selectedSourceTypes.length
  const resourceTypeActive = placesChosen + selectedTherapy.length + selectedActivities.length + shopChosen + commentariesActive

  // "Check out their full page of commentaries here!": everything from the
  // chosen sources; Tidbits' own page when Tidbits is the one chosen.
  const fullPage =
    selectedSourceTypes.length === 1 && selectedSourceTypes[0] === 'tidbits'
      ? '/community'
      : `/search?categories=commentary&sourceTypes=${selectedSourceTypes.join(',')}`

  const personalityActive = selectedConditions.filter((t) => PERSONALITY.has(decodeCondition(t).id)).length
  const normsActive = selectedBarriers.length + selectedConditions.length - personalityActive
  const trendingActive = TRENDING_FILTERS.filter((t) => selectedSpecialTags.includes(t.id)).length

  return (
    <div className="space-y-6">
      {/* Resource Type — services/places AND shop categories (Odosa: "add the
          filters from Shop to the Resource Type filter list"), Activities
          and Commentaries (the team's notes, October 2026). Grouped rather
          than merged into a flat list: "Books" sitting between "Therapy" and
          "School" with no distinction reads as a mistake. Each group opens
          and closes ("a dropdown at every level"). */}
      <FilterSection title="Resource Type" active={resourceTypeActive}>
        <FilterGroup label="Services & Places" active={placesChosen + selectedTherapy.length}>
          <div className="max-h-72 overflow-y-auto pr-1">
            {placeCategories.length > 0 ? (
              placeCategories.map((category) =>
                category.toLowerCase() === THERAPY_CATEGORY ? (
                  <TherapyChoices
                    key={category}
                    category={category}
                    checked={isChosen(category)}
                    therapy={selectedTherapy}
                    onCategoryToggle={onCategoryToggle}
                    onTherapyToggle={onTherapyToggle}
                  />
                ) : (
                  <label key={category} className={ROW}>
                    <input type="checkbox" checked={isChosen(category)} onChange={() => onCategoryToggle(category)} className={BOX} />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{category}</span>
                  </label>
                )
              )
            ) : (
              <p className="text-sm text-gray-500 px-2">Loading categories...</p>
            )}
          </div>
        </FilterGroup>

        {onActivityToggle && (
          <FilterGroup label="Activities" active={selectedActivities.length}>
            {ACTIVITIES.map((a) => (
              <label key={a.id} className={ROW}>
                <input type="checkbox" checked={selectedActivities.includes(a.id)} onChange={() => onActivityToggle(a.id)} className={BOX} />
                <span className="ml-2 text-sm text-gray-700">{a.label}</span>
              </label>
            ))}
          </FilterGroup>
        )}

        <FilterGroup label="Shop" active={shopChosen}>
          {/* The shop's 11 groups (its 40 categories are on the shop page). */}
          {SHOP_GROUPS.map((c) => {
            const Icon = c.icon
            return (
              <label key={c.id} className={ROW}>
                <input type="checkbox" checked={selectedCategories.includes(c.id)} onChange={() => onCategoryToggle(c.id)} className={BOX} />
                <Icon className="w-4 h-4 ml-2 shrink-0 text-gray-400" aria-hidden="true" />
                <span className="ml-2 text-sm text-gray-700">{c.label}</span>
              </label>
            )
          })}
        </FilterGroup>

        {/* Commentaries (Odosa): News; Social Media Posts; Videos; and
            Tidbits, Autinerary's own, which come back beside the listings. */}
        <FilterGroup label="Commentaries" active={commentariesActive} defaultOpen={commentariesActive > 0}>
          <label className={ROW}>
            <input type="checkbox" checked={commentaryChosen} onChange={() => onCategoryToggle('commentary')} className={BOX} />
            <span className="ml-2 text-sm text-gray-700">All commentaries</span>
          </label>
          {onSourceTypeToggle && (
            <div className="ml-2">
              {SOURCE_TYPE_GROUPS.map((group) => (
                <FilterGroup key={group.label} label={group.label} active={sourcesFor(group)}>
                  <div className="pl-1">
                    {group.options.map((opt) => (
                      <label key={opt.id} className="flex items-center gap-2 p-1.5 text-sm text-gray-700 cursor-pointer">
                        <input type="checkbox" checked={selectedSourceTypes.includes(opt.id)} onChange={() => onSourceTypeToggle(opt.id)} className={BOX} />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </FilterGroup>
              ))}
              {selectedSourceTypes.length > 0 && (
                <Link href={fullPage} className="mt-2 block px-2 text-xs font-semibold text-purple-800 underline hover:text-purple-900">
                  Check out their full page of commentaries here!
                </Link>
              )}
            </div>
          )}
        </FilterGroup>
      </FilterSection>

      {/* Norms — barrier categories + conditions merged (Odosa). The
          "Neurodivergence" barrier is dropped; it's covered by the
          "Neurodevelopmental Conditions" group below. */}
      <FilterSection title="Norms" active={normsActive}>
        <div className="space-y-1 border border-gray-200 rounded-lg overflow-hidden">
          {FILTER_NORM_GROUPS.map((g) => {
            const isExpanded = !collapsedNormGroups.has(g.key)
            // Surfaced on the header so a collapsed group still advertises
            // that it is filtering the results.
            const selectedCount = g.norms.filter((b) => selectedBarriers.includes(b.id)).length
            return (
              <div key={g.key} className="border-b border-gray-200 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleBarrierCategory(g.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span className="text-sm font-medium text-gray-900">
                    {g.label}
                    {selectedCount > 0 && (
                      <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-semibold">
                        {selectedCount}
                      </span>
                    )}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="w-4 h-4 text-gray-500" aria-hidden="true" />}
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 bg-gray-50 space-y-1 max-h-64 overflow-y-auto">
                    {g.norms.map((barrier) => (
                      <label key={barrier.id} className="flex items-center cursor-pointer hover:bg-white p-2 rounded">
                        <input type="checkbox" checked={selectedBarriers.includes(barrier.id)} onChange={() => onBarrierToggle(barrier.id)} className={BOX} />
                        <span className="ml-2 text-sm text-gray-700">{barrier.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {/* Conditions taxonomy, merged into the same "Norms" box */}
          <ConditionsFilter embedded selected={selectedConditions} onChange={onConditionsChange} except={['personality_disorders']} />
        </div>
      </FilterSection>

      {/* Personality, apart from norms (the planning note, October 2026:
          "Personality vs Norm"), so either can be chosen on its own. */}
      <FilterSection title="Personality" hint="Lasting patterns in how someone thinks, feels and relates; kept apart from norms." active={personalityActive}>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <ConditionsFilter embedded selected={selectedConditions} onChange={onConditionsChange} only={['personality_disorders']} />
        </div>
      </FilterSection>

      {/* Life categories, each with its own choices (lib/search/lifeAreas.ts,
          lib/filters/tags.ts). Matching by words until places are tagged. */}
      <FilterSection title="Life Category" hint="Choose one to see its own choices." active={selectedLifeAreas.length}>
        <LifeCategoryFilters
          headless
          lifeAreas={selectedLifeAreas}
          tags={selectedTags}
          country={country}
          onLifeAreaToggle={onLifeAreaToggle}
          onTagToggle={(id) => onTagToggle?.(id)}
        />
      </FilterSection>

      {onTagToggle && onCostTypeChange && onOnlineChange && onServiceAgeChange && (
        <TagFilters
          tags={selectedTags}
          costType={costType}
          online={online}
          age={serviceAge}
          hasLocation={Boolean(place)}
          onTagToggle={onTagToggle}
          onCostChange={onCostTypeChange}
          onOnlineChange={onOnlineChange}
          shortWait={shortWait}
          onShortWaitChange={onShortWaitChange}
          onAgeChange={onServiceAgeChange}
        />
      )}

      {/* Special Tags (Odosa), each as it looks on the cards: "Autinerary's
          Own" in its gradient, shining; Surprising Finds; Trending by how
          long the interest has lasted, in bronze, silver, gold and platinum;
          Rare and Highly requested. */}
      {onSpecialTagToggle && (
        <FilterSection title="Special Tags" active={selectedSpecialTags.length}>
          <div className="flex flex-wrap gap-2">
            {SPECIAL_TAGS.filter((t) => t.id === 'first_party' || t.id === 'surprising_find').map((tag) => (
              <SpecialChip key={tag.id} label={tag.label} className={tag.className} active={selectedSpecialTags.includes(tag.id)} onClick={() => onSpecialTagToggle(tag.id)} />
            ))}
          </div>
          <FilterGroup label="Trending" active={trendingActive} defaultOpen>
            <div className="flex flex-wrap gap-2 px-1 pt-1">
              {TRENDING_FILTERS.map((t) => {
                const tier = TRENDING_TIERS.find((x) => x.id === t.tier)!
                return (
                  <SpecialChip key={t.id} label={t.label} className={`shine ${tier.className}`} active={selectedSpecialTags.includes(t.id)} onClick={() => onSpecialTagToggle(t.id)} />
                )
              })}
            </div>
          </FilterGroup>
          <div className="mt-3 flex flex-wrap gap-2">
            {SPECIAL_TAGS.filter((t) => t.id === 'rare' || t.id === 'highly_requested').map((tag) => (
              <SpecialChip key={tag.id} label={tag.label} className={tag.className} active={selectedSpecialTags.includes(tag.id)} onClick={() => onSpecialTagToggle(tag.id)} />
            ))}
          </div>
        </FilterSection>
      )}

      {/* Service Ratings (chip style) */}
      <FilterSection title="Community Star Rating" active={ratingStars.length}>
        <RatingChipsFilter headless selectedStars={ratingStars} onChange={onRatingStarsChange} />
      </FilterSection>

      <FilterSection
        title="Cost Per Service"
        active={minPrice !== undefined || maxPrice !== undefined ? 1 : 0}
        action={
          (minPrice !== undefined || maxPrice !== undefined) && (
            <button type="button" onClick={() => onPriceChange({ min: undefined, max: undefined })} className="text-xs text-blue-700 underline hover:text-blue-800">
              Clear
            </button>
          )
        }
      >
        <CostFilter headless min={minPrice} max={maxPrice} onChange={onPriceChange} />
      </FilterSection>

      {/* Connection Type to Norm (Odosa). Filters by the connection type of
          the people who RATED a resource — "show me what actually-diagnosed
          people rated" is a different question from "what allies rated". */}
      {onConnectionTypeToggle && (
        <FilterSection title="Connection Type to Norm" hint="Whose experience the ratings come from." active={selectedConnectionTypes.length}>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {CONNECTION_TYPES.map((c) => (
              <label key={c.id} className={`flex items-center gap-2 text-sm text-gray-700 cursor-pointer ${'parent' in c ? 'ml-5' : ''}`}>
                <input type="checkbox" checked={selectedConnectionTypes.includes(c.id)} onChange={() => onConnectionTypeToggle(c.id)} className={BOX} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Age Range (Odosa). Note an empty age_ranges on a resource means
          "not stated", which the API treats as unknown rather than quietly
          matching every band. */}
      {onAgeRangeToggle && (
        <FilterSection title="Age Range" active={selectedAgeRanges.length}>
          <div className="space-y-1.5">
            {AGE_RANGES.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={selectedAgeRanges.includes(a.id)} onChange={() => onAgeRangeToggle(a.id)} className={BOX} />
                <span>{a.label}</span>
              </label>
            ))}
          </div>
        </FilterSection>
      )}

      {/* Rating Filter */}
      <FilterSection title="Minimum Overall Rating" active={minRating !== undefined ? 1 : 0}>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <label key={rating} className={ROW}>
              <input
                type="radio"
                name="rating"
                checked={minRating === rating}
                onChange={() => onMinRatingChange(minRating === rating ? undefined : rating)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">
                {rating}+ stars
                {rating === 5 && <span className="ml-1 text-xs text-gray-500">(Excellent)</span>}
              </span>
            </label>
          ))}
          <label className={ROW}>
            <input
              type="radio"
              name="rating"
              checked={minRating === undefined}
              onChange={() => onMinRatingChange(undefined)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">Any rating</span>
          </label>
        </div>
      </FilterSection>

      {/* Distance Filter */}
      <FilterSection
        title="Distance From You"
        active={maxDistance !== undefined ? 1 : 0}
        hint={
          place ? (
            <>
              From {place} ·{' '}
              <Link href="/profile#location" className="font-medium text-blue-700 underline">
                Change
              </Link>
            </>
          ) : undefined
        }
      >
        <div className="space-y-2">
          {[5, 10, 25, 50, 100].map((distance) => (
            <label key={distance} className={ROW}>
              <input
                type="radio"
                name="distance"
                checked={maxDistance === distance}
                onChange={() => onMaxDistanceChange(maxDistance === distance ? undefined : distance)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm text-gray-700">
                Within {distance} km
                {distance === 5 && <span className="ml-1 text-xs text-gray-500">(Nearby)</span>}
              </span>
            </label>
          ))}
          <label className={ROW}>
            <input
              type="radio"
              name="distance"
              checked={maxDistance === undefined}
              onChange={() => onMaxDistanceChange(undefined)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="ml-2 text-sm text-gray-700">Any distance</span>
          </label>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {place ? (
            'With no distance chosen, places within 50 km come first, nearest first.'
          ) : signedIn ? (
            <>
              <Link href="/profile#location" className="font-medium text-blue-700 underline">
                Set your location
              </Link>{' '}
              to see places near you first. It is private and optional.
            </>
          ) : (
            'Sign in and set a location to see places near you first.'
          )}
        </p>
      </FilterSection>

      {/* Clear Filters */}
      {onClearFilters && (
        <div>
          <button
            onClick={onClearFilters}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  )
}
