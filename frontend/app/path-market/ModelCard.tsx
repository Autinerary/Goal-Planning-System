'use client'

import { Clock, User, Users } from 'lucide-react'
import { NORM_GROUPS } from '@/lib/norms/taxonomy'
import { CONNECTION_TYPES } from '@/lib/filters/taxonomy'
import { PATH_CATEGORIES, type MarketCategory, type MarketModel } from '@/lib/pathMarket'

const NORM_LABEL: Record<string, string> = Object.fromEntries(NORM_GROUPS.flatMap((g) => g.norms.map((n) => [n.id, n.label])))
const CONNECTION_LABEL: Record<string, string> = Object.fromEntries(CONNECTION_TYPES.map((c) => [c.id, c.label]))
const AREA = Object.fromEntries(PATH_CATEGORIES.map((a) => [a.id, a])) as Record<string, (typeof PATH_CATEGORIES)[number]>

const STATUS: Record<MarketModel['status'], { label: string; cls: string }> = {
  live: { label: 'Available', cls: 'bg-emerald-100 text-emerald-900' },
  coming: { label: 'Coming soon', cls: 'bg-slate-100 text-slate-800' },
  pending: { label: 'Waiting for review', cls: 'bg-amber-100 text-amber-900' },
}

export const normLabel = (id: string) => NORM_LABEL[id] || id

/** A model's labels: its categories (and their life categories), norms and connection type to norm. */
export function ModelLabels({ model, categories, className = '' }: { model: MarketModel; categories: Record<string, MarketCategory>; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Labels">
      {model.categoryKeys.map((k) => {
        const c = categories[k]
        if (!c) return null
        return (
          <li key={k} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-900" title={c.lifeAreas.map((a) => AREA[a]?.label).join(', ')}>
            <span aria-hidden="true">{c.lifeAreas.map((a) => AREA[a]?.emoji).join('')} </span>{c.title}
          </li>
        )
      })}
      {model.norms.map((n) => (
        <li key={n} className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-0.5 text-xs font-semibold text-cyan-900">{normLabel(n)}</li>
      ))}
      {model.connectionTypes.map((c) => (
        <li key={c} className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800">{CONNECTION_LABEL[c] || c}</li>
      ))}
      {model.norms.length === 0 && model.connectionTypes.length === 0 && (
        <li className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">For any norms</li>
      )}
    </ul>
  )
}

/**
 * One Life Path Model (the team's notes, October 2026): a whole path, with a
 * name of its own, its labels, its races and people, its contributors and a
 * short description, and "Start this Path".
 */
export default function ModelCard({
  model,
  categories,
  onStart,
  onComingSoon,
}: {
  model: MarketModel
  categories: Record<string, MarketCategory>
  onStart: (m: MarketModel) => void
  onComingSoon: (m: MarketModel) => void
}) {
  const status = STATUS[model.status]
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-model={model.key}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-bold text-slate-900">{model.name}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${status.cls}`}>
          {model.status === 'coming' && <Clock className="mr-0.5 inline h-3 w-3" aria-hidden="true" />}
          {status.label}
        </span>
        {model.isOwn && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-sky-900">Yours</span>}
      </div>
      {model.contributors.length > 0 && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-700"><User className="h-3 w-3" aria-hidden="true" /> by {model.contributors.join(', ')}</p>
      )}
      <p className="mt-2 text-sm text-slate-800">{model.description}</p>
      <ModelLabels model={model} categories={categories} className="mt-2" />
      <p className="mt-2 text-xs text-slate-700">
        {model.races.length} {model.races.length === 1 ? 'race' : 'races'}
        {model.races.length > 0 && `: ${model.races.slice(0, 3).map((r) => r.name).join(' · ')}${model.races.length > 3 ? ' …' : ''}`}
        {model.people.length > 0 && (
          <span className="ml-1 inline-flex items-center gap-1"><Users className="h-3 w-3" aria-hidden="true" /> {model.people.length} {model.people.length === 1 ? 'person' : 'people'}</span>
        )}
      </p>
      <div className="mt-auto pt-3">
        {model.status === 'live' ? (
          <button type="button" onClick={() => onStart(model)} className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800">
            Start this Path
          </button>
        ) : model.status === 'coming' ? (
          <button type="button" onClick={() => onComingSoon(model)} className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100">
            Coming soon →
          </button>
        ) : (
          <button type="button" disabled className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Waiting for review
          </button>
        )}
      </div>
    </article>
  )
}
