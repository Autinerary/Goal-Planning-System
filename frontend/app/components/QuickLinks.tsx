'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Sparkles, Target, Wrench, Users, BookOpen, Map, Compass, Store, Home, HelpCircle, ChevronDown, type LucideIcon } from 'lucide-react'
import { goHubHref } from '@/lib/serviceHub'
import { placesFor, type PlaceKey } from '@/lib/places'
import AllPlaces from './PathMenus'

const ICONS: Record<PlaceKey, { Icon: LucideIcon; color: string }> = {
  races: { Icon: Target, color: 'text-cyan-600' },
  pitstop: { Icon: Wrench, color: 'text-purple-600' },
  hareworld: { Icon: Users, color: 'text-pink-600' },
  journal: { Icon: BookOpen, color: 'text-amber-600' },
  tidbits: { Icon: Sparkles, color: 'text-emerald-600' },
  resourcehub: { Icon: Map, color: 'text-cyan-600' },
  pathmarket: { Icon: Store, color: 'text-rose-600' },
  starter: { Icon: Compass, color: 'text-indigo-600' },
  family: { Icon: Home, color: 'text-orange-600' },
  help: { Icon: HelpCircle, color: 'text-indigo-600' },
}

/**
 * Quick Links: the one way to the app's places from the Path, near the top
 * (Riipen Labs, Group 34: "move the quick links from the bottom of the page
 * to the top"). Each themed name says plainly what it is (Group 3:
 * "unfamiliar terms such as Pit Stop"), in an order that suits who the
 * person is planning for (Group 32; lib/places.ts). The simple view shows
 * four. "All places" lists everything, grouped, one level deep: it replaces
 * the six dropdown menus that sat above the Path's title (Groups 31 and 32:
 * "too many dropdowns", "competing pathways").
 */
export default function QuickLinks({ audience, startPath, simple }: { audience?: string | null; startPath?: boolean; simple?: boolean }) {
  const [all, setAll] = useState(false)
  const places = placesFor(audience, { startPath })
  const shown = simple ? places.slice(0, 4) : places
  return (
    <section aria-labelledby="quick-links-heading" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm mb-6">
      <h2 id="quick-links-heading" className="font-bold text-lg text-slate-800 mb-3 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-purple-500" aria-hidden="true" /> Quick Links
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {shown.map((place) => {
          const { Icon, color } = ICONS[place.key]
          const body = (
            <>
              <Icon className={`w-5 h-5 shrink-0 ${color}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{place.name}</span>
                <span className="block text-xs text-slate-600">{place.what}</span>
              </span>
            </>
          )
          const cls = 'flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-3 py-3 sm:px-4 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm'
          return place.hub ? (
            <a key={place.key} href={goHubHref(place.href)} target="_blank" rel="noopener noreferrer" className={cls} data-info={place.info}>{body}</a>
          ) : (
            <Link key={place.key} href={place.href} className={cls} data-info={place.info}>{body}</Link>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={all}
          aria-controls="all-places"
          onClick={() => setAll(!all)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${all ? 'rotate-180' : ''}`} aria-hidden="true" />
          {all ? 'Fewer places' : 'All places'}
        </button>
        <p className="text-sm text-slate-700">
          New words? <Link href="/help" className="font-medium text-indigo-800 underline underline-offset-2">See what things are called</Link>
        </p>
      </div>
      {all && <AllPlaces id="all-places" />}
    </section>
  )
}
