'use client'

import { useEffect, useState } from 'react'
import AvatarEditor, { type Appearance } from '../components/AvatarEditor'

type Supported = { dream?: string; relationship?: string; appearance?: Appearance }

/**
 * For someone here for another person (Odosa, with Eli's feedback, October
 * 2026): a dream for where you see them, a dream for how things could be
 * between you, and that person's Dream Self look, made like your own
 * character rather than with an AI picture. Only the person who writes it
 * sees it.
 */
export default function SupportedDream({ who, saved, fallback, onSave }: { who: string; saved?: Supported; fallback: Appearance; onSave: (next: Supported) => void }) {
  const [dream, setDream] = useState(saved?.dream || '')
  const [relationship, setRelationship] = useState(saved?.relationship || '')
  useEffect(() => {
    setDream(saved?.dream || '')
    setRelationship(saved?.relationship || '')
  }, [saved?.dream, saved?.relationship])
  const save = (change: Supported) => onSave({ ...(saved || {}), ...change })
  return (
    <section aria-labelledby="supported-dream-heading" className="lg:col-span-2 grid gap-6 rounded-2xl border border-slate-200 p-6 surface sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h3 id="supported-dream-heading" className="font-bold text-slate-800">Dreams for {who}</h3>
        <p className="mt-1 text-sm text-slate-700">Where you hope {who} will be, and how you&apos;d like things to be between you. Both optional, and only you see them.</p>
      </div>
      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-800">
          Where you see {who}
          <textarea value={dream} maxLength={400} rows={3} onChange={(e) => setDream(e.target.value)} onBlur={() => dream !== (saved?.dream || '') && save({ dream })} placeholder="For example: making friends at their new school" className="mt-2 block w-full rounded-lg border bg-white p-2" />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          How you&apos;d like things to be between you
          <textarea value={relationship} maxLength={400} rows={3} onChange={(e) => setRelationship(e.target.value)} onBlur={() => relationship !== (saved?.relationship || '') && save({ relationship })} placeholder="For example: calmer mornings together" className="mt-2 block w-full rounded-lg border bg-white p-2" />
        </label>
      </div>
      <AvatarEditor title={`${who.charAt(0).toUpperCase()}${who.slice(1)}'s Dream Self look`} value={saved?.appearance || fallback} onChange={(appearance) => save({ appearance })} />
    </section>
  )
}
