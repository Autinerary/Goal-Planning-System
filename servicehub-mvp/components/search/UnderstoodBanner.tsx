'use client'

import { X } from 'lucide-react'
import type { Understood } from '@/lib/search/understand'
import { APP_AI_HELP } from '@/lib/appSignIn'

/**
 * What a search typed the way it would be said was read as (lib/search/
 * understand.ts), each part with a way to take it away, and the parts that
 * could be filters offered as filters. Says AI only when AI read it, once,
 * with what it is used for (docs/design-guide.md, rule 3).
 */
export default function UnderstoodBanner({
  understood,
  onDrop,
  onExact,
  onFilterNorms,
  onFilterAges,
  normsApplied,
  agesApplied,
}: {
  understood: Understood
  onDrop: (part: string) => void
  onExact: () => void
  onFilterNorms: (ids: string[]) => void
  onFilterAges: (ranges: string[]) => void
  normsApplied: boolean
  agesApplied: boolean
}) {
  const { intents, place, norms, ages, words, by } = understood
  const chip = (key: string, label: string, part: string, kind: string) => (
    <li key={key}>
      <button
        type="button"
        onClick={() => onDrop(part)}
        className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-900 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="sr-only">{kind}: </span>
        {label}
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only"> (take away)</span>
      </button>
    </li>
  )
  const ranges = Array.from(new Set(ages.flatMap((a) => a.ranges)))

  return (
    <section aria-labelledby="understood-heading" className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
      <h2 id="understood-heading" className="text-sm font-semibold text-gray-900">
        {by === 'ai' ? 'Read with AI from what you typed' : 'What we understood'}
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {intents.map((i) => chip(`i-${i.id}`, i.label, `intent:${i.id}`, 'Kind of place'))}
        {place && chip('place', `Near ${place.name}`, 'place', 'Where')}
        {norms.map((n) => chip(`n-${n.id}`, n.label, `norm:${n.id}`, 'Norm'))}
        {ages.map((a) => chip(`a-${a.id}`, `For ${a.label.charAt(0).toLowerCase()}${a.label.slice(1)}`, `age:${a.id}`, 'Who for'))}
        {words.map((w) => chip(`w-${w}`, `“${w}”`, `word:${w}`, intents.length ? 'Listed first when it matches' : 'Words'))}
      </ul>
      {(norms.length > 0 || ages.length > 0) && (
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          {norms.length > 0 && !normsApplied && (
            <button type="button" onClick={() => onFilterNorms(norms.map((n) => n.id))} className="font-medium text-blue-700 underline">
              Only places rated by people with {norms.map((n) => n.label).join(' or ')}
            </button>
          )}
          {ages.length > 0 && !agesApplied && (
            <button type="button" onClick={() => onFilterAges(ranges)} className="font-medium text-blue-700 underline">
              Only places that say they serve {ages.map((a) => a.label.toLowerCase()).join(' or ')}
            </button>
          )}
        </p>
      )}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button type="button" onClick={onExact} className="font-medium text-gray-700 underline hover:text-gray-900">
          Search the exact words instead
        </button>
        {by === 'ai' && (
          <a href={APP_AI_HELP} className="font-medium text-gray-700 underline hover:text-gray-900">
            How Autinerary uses AI
          </a>
        )}
      </p>
    </section>
  )
}
