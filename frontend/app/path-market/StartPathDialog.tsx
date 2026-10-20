'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Users, X } from 'lucide-react'
import PathResources from '@/app/components/PathResources'
import { goHubHref } from '@/lib/serviceHub'
import { tidbitQuery } from '@/lib/tidbitQuery'
import { PATH_CATEGORIES, type MarketCategory, type MarketModel } from '@/lib/pathMarket'
import { ModelLabels } from './ModelCard'

const AREA = Object.fromEntries(PATH_CATEGORIES.map((a) => [a.id, a])) as Record<string, (typeof PATH_CATEGORIES)[number]>
const TINT: Record<string, string> = {
  education: 'border-violet-200 bg-violet-50/60',
  career: 'border-amber-200 bg-amber-50/60',
  relationships: 'border-pink-200 bg-pink-50/60',
  health: 'border-emerald-200 bg-emerald-50/60',
  barrier: 'border-sky-200 bg-sky-50/60',
  other: 'border-slate-200 bg-slate-50/60',
}

/**
 * "Start this Path" (the team's notes, October 2026): the model's races side
 * by side, like the Race view's multi-race view, to take whole ("suggestions
 * for entire races") or a step at a time ("smaller suggestions for
 * milestones"), with the category's smaller step ideas, the people on the
 * path, resources and related Tidbits (in a new tab). Nothing is chosen for
 * you. Chosen races become goals in setup; chosen steps go with their race
 * for the planner (lib/pathMarket.ts startSeed).
 */
export default function StartPathDialog({
  model,
  categories,
  onClose,
  onStart,
}: {
  model: MarketModel | null
  categories: Record<string, MarketCategory>
  onClose: () => void
  onStart: (model: MarketModel, races: string[], steps: Record<string, string[]>) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [races, setRaces] = useState<string[]>([])
  const [steps, setSteps] = useState<Record<string, string[]>>({})
  // Each idea chosen, and the race it goes with.
  const [ideas, setIdeas] = useState<Record<string, string>>({})

  useEffect(() => {
    setRaces([])
    setSteps({})
    setIdeas({})
    if (model && !dialog.current?.open) dialog.current?.showModal()
    if (!model && dialog.current?.open) dialog.current.close()
  }, [model])

  if (!model) return null
  const first = categories[model.categoryKeys[0]]
  const toggleRace = (name: string) => {
    if (races.includes(name)) {
      setRaces(races.filter((r) => r !== name))
      setSteps({ ...steps, [name]: [] })
      setIdeas(Object.fromEntries(Object.entries(ideas).filter(([, r]) => r !== name)))
    } else setRaces([...races, name])
  }
  const toggleStep = (race: string, step: string) => {
    const list = steps[race] || []
    const on = list.includes(step)
    setSteps({ ...steps, [race]: on ? list.filter((s) => s !== step) : [...list, step] })
    if (!on && !races.includes(race)) setRaces([...races, race])
  }
  const toggleIdea = (idea: string) => {
    if (idea in ideas) setIdeas(Object.fromEntries(Object.entries(ideas).filter(([k]) => k !== idea)))
    else {
      const race = races[0] || model.races[0]?.name
      if (!race) return
      if (!races.includes(race)) setRaces([...races, race])
      setIdeas({ ...ideas, [idea]: race })
    }
  }
  const start = () => {
    const chosen: Record<string, string[]> = {}
    for (const r of races) chosen[r] = [...(steps[r] || [])]
    for (const [idea, race] of Object.entries(ideas)) if (races.includes(race)) (chosen[race] ||= []).push(idea)
    onStart(model, races, chosen)
  }
  const topics = Array.from(new Set([...model.races.map((r) => tidbitQuery(r.name)), first?.title || ''].filter(Boolean))).slice(0, 4)

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      aria-labelledby="start-path-title"
      className="max-h-[92vh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl bg-white p-0 backdrop:bg-black/50"
      data-start-path={model.key}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="start-path-title" className="text-xl font-bold text-slate-900">{model.name}</h2>
            {model.contributors.length > 0 && <p className="text-sm text-slate-700">Contributed by {model.contributors.join(', ')}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1 text-slate-700 hover:bg-slate-100"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>
        <p className="mt-2 text-sm text-slate-800">{model.description}</p>
        <ModelLabels model={model} categories={categories} className="mt-2" />

        <h3 className="mt-6 text-lg font-semibold text-slate-900">Races in this path</h3>
        <p className="text-sm text-slate-700">Take a whole race, or only the steps you want. Nothing is chosen for you.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-race-columns>
          {model.races.map((race, ri) => {
            const area = AREA[race.area]
            const on = races.includes(race.name)
            return (
              <section key={race.name} aria-labelledby={`race-${ri}`} className={`rounded-xl border-2 p-3 ${TINT[race.area] || TINT.other} ${on ? 'ring-2 ring-indigo-500' : ''}`}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input type="checkbox" checked={on} onChange={() => toggleRace(race.name)} className="mt-1 h-4 w-4" />
                  <span>
                    <span id={`race-${ri}`} className="block font-semibold text-slate-900">{race.name}</span>
                    <span className="text-xs text-slate-700">{area ? `${area.emoji} ${area.label}` : 'Other'} · Take this race</span>
                  </span>
                </label>
                {race.milestones.length > 0 ? (
                  <ol className="mt-3 flex flex-col-reverse gap-1.5" aria-label={`Steps in ${race.name}, the first at the bottom`}>
                    {race.milestones.map((m, i) => (
                      <li key={m}>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-white bg-white/80 p-2 text-sm text-slate-900">
                          <input type="checkbox" checked={(steps[race.name] || []).includes(m)} onChange={() => toggleStep(race.name, m)} className="mt-0.5 h-4 w-4" />
                          <span><span className="text-xs font-mono text-slate-600">Step {i + 1}</span><span className="block">{m}</span></span>
                        </label>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-slate-700">No steps written for this race yet. If you take it, your plan writes them.</p>
                )}
              </section>
            )
          })}
          {model.races.length === 0 && <p className="text-sm text-slate-700">This path has no races yet.</p>}
        </div>

        {model.stepIdeas.length > 0 && (
          <fieldset className="mt-6">
            <legend className="text-lg font-semibold text-slate-900">Smaller steps you could add</legend>
            <p className="text-sm text-slate-700">Ideas from {first?.title || 'this category'}. Each goes with the race you pick.</p>
            <ul className="mt-2 space-y-2">
              {model.stepIdeas.map((idea) => (
                <li key={idea} className="flex flex-wrap items-center gap-2">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm text-slate-900">
                    <input type="checkbox" checked={idea in ideas} onChange={() => toggleIdea(idea)} className="h-4 w-4" disabled={!model.races.length} />
                    {idea}
                  </label>
                  {idea in ideas && races.length > 1 && (
                    <label className="text-xs text-slate-800">
                      <span className="mr-1">for</span>
                      <select value={ideas[idea]} onChange={(e) => setIdeas({ ...ideas, [idea]: e.target.value })} className="rounded border border-slate-300 px-1 py-0.5 text-xs">
                        {races.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </label>
                  )}
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {model.people.length > 0 && (
          <section className="mt-6" aria-labelledby="path-people">
            <h3 id="path-people" className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Users className="h-5 w-5" aria-hidden="true" /> People on this path</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {model.people.map((p) => <li key={p.role}><span className="font-semibold">{p.role}</span>{p.note ? `: ${p.note}` : ''}</li>)}
            </ul>
          </section>
        )}

        <PathResources categoryKey={first?.key} />

        <h3 className="mb-2 mt-6 font-medium text-slate-900">Related Tidbits</h3>
        <div className="flex flex-wrap gap-3">
          {topics.map((topic) => (
            <a key={topic} href={goHubHref(`/community?${new URLSearchParams({ q: topic, from: 'path-market' })}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-cyan-800 underline">
              {topic} <ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" onClick={start} className="rounded-xl bg-indigo-700 px-5 py-2.5 font-semibold text-white hover:bg-indigo-800">
            Start this Path{races.length ? ` with ${races.length} ${races.length === 1 ? 'race' : 'races'}` : ''}
          </button>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2.5 font-semibold text-slate-900">Cancel</button>
          <span className="text-sm text-slate-700">Setup comes next, with these filled in. You can change anything there.</span>
        </div>
      </div>
    </dialog>
  )
}
