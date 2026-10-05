'use client'

import { useEffect, useState, FormEvent } from 'react'
import Link from 'next/link'
import { MapPin, Palette, Heart, SlidersHorizontal, Ear, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { dayKey, daysSince } from '@/lib/disclosure'
import { dueAskLaterGroup } from '@/lib/askLater'

/**
 * "Ask later" (Riipen Labs, Group 2: "sort the questions into need now and ask
 * later"). Setup ends after two questions; the optional ones this person did
 * not get to are offered here instead. Onboarding writes the list at submit;
 * links go to where each one already lives, and location can be added right
 * here.
 *
 * Group 5 asked for them to come back gradually, over days 7 to 14: one
 * group at a time, by days since sign-up (lib/askLater.ts).
 */

const KEY = 'autinerary_ask_later'

const LINKS: Record<string, { icon: typeof Palette; title: string; body: string; href: string }> = {
  aboutYou: { icon: Ear, title: 'Sensory needs and conditions', body: 'So plans and suggestions can fit how you work. Private.', href: '/profile/diagnostic' },
  character: { icon: Palette, title: 'Design your character', body: 'Your avatar in Dream Land.', href: '/ideal-self' },
  spiritAnimal: { icon: Heart, title: 'Choose your spirit animals', body: 'The guides shown on your Path.', href: '/profile/settings' },
  personalize: { icon: SlidersHorizontal, title: 'Adjust how the app looks', body: 'Layout, colours, and how much it shows at once.', href: '/profile/settings' },
}

export default function AskLaterCard() {
  const { supabaseUser } = useAuth()
  const [items, setItems] = useState<string[]>([])
  const [loc, setLoc] = useState({ city: '', province: '', country: '' })
  const [locState, setLocState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [locError, setLocError] = useState('')

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '[]')
      if (Array.isArray(saved)) setItems(saved.filter((x) => typeof x === 'string'))
    } catch {}
  }, [])

  const save = (next: string[]) => {
    setItems(next)
    try {
      if (next.length) localStorage.setItem(KEY, JSON.stringify(next))
      else localStorage.removeItem(KEY)
    } catch {}
  }
  const remove = (id: string) => save(items.filter((x) => x !== id))

  async function saveLocation(e: FormEvent) {
    e.preventDefault()
    if (!loc.city.trim()) {
      setLocState('error')
      setLocError('Please enter a city.')
      return
    }
    setLocState('saving')
    try {
      const res = await fetch('/api/me/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setLocState('error')
        setLocError(res.status === 422 ? "We couldn't find that place. Check the spelling, or try a nearby city." : body.error || 'Could not save. Please try again.')
        return
      }
      remove('location')
    } catch {
      setLocState('error')
      setLocError('Could not reach the server. Please try again.')
    }
  }

  // Days since the account was made; unknown counts as day 0.
  const day = supabaseUser?.created_at ? daysSince(dayKey(new Date(supabaseUser.created_at))) : 0
  const group = dueAskLaterGroup(items, day)
  if (!group) return null
  const links = group.ids.filter((id) => id !== 'location' && items.includes(id))

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="ask-later-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ask-later-heading" className="font-bold text-slate-900">{group.title}</h2>
          <p className="text-sm text-slate-700">{group.intro}</p>
        </div>
        <button
          type="button"
          onClick={() => save(items.filter((id) => !group.ids.includes(id)))}
          aria-label="Hide these suggestions"
          className="text-slate-500 hover:text-slate-800"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {group.ids.includes('location') && items.includes('location') && (
          <li className="rounded-xl border border-slate-200 p-3 sm:col-span-2">
            <form onSubmit={saveLocation}>
              <p className="flex items-center gap-2 font-semibold text-slate-900">
                <MapPin className="h-4 w-4 text-indigo-700" aria-hidden="true" /> Add your location
              </p>
              <p className="mb-2 text-sm text-slate-700">So ResourceHub can show services near you. Private.</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                {(['city', 'province', 'country'] as const).map((field) => (
                  <input
                    key={field}
                    value={loc[field]}
                    onChange={(e) => setLoc((prev) => ({ ...prev, [field]: e.target.value }))}
                    aria-label={field === 'province' ? 'Province or state' : field[0].toUpperCase() + field.slice(1)}
                    placeholder={field === 'city' ? 'City' : field === 'province' ? 'Province / state' : 'Country'}
                    maxLength={100}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-500"
                  />
                ))}
                <button
                  type="submit"
                  disabled={locState === 'saving'}
                  className="rounded-md bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
                >
                  {locState === 'saving' ? 'Saving…' : 'Save'}
                </button>
              </div>
              {locState === 'error' && <p className="mt-2 text-sm text-red-700" role="alert">{locError}</p>}
            </form>
          </li>
        )}
        {links.map((id) => {
          const { icon: Icon, title, body, href } = LINKS[id]
          return (
            <li key={id}>
              <Link
                href={href}
                onClick={() => remove(id)}
                className="flex h-full gap-3 rounded-xl border border-slate-200 p-3 hover:border-indigo-400"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" aria-hidden="true" />
                <span>
                  <span className="block font-semibold text-slate-900">{title}</span>
                  <span className="block text-sm text-slate-700">{body}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
