'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Send, Trash2, X } from 'lucide-react'
import { NORM_GROUPS } from '@/lib/norms/taxonomy'
import { CONNECTION_TYPES } from '@/lib/filters/taxonomy'
import { PATH_CATEGORIES, type LifeArea, type MarketCategory } from '@/lib/pathMarket'

type RaceRow = { name: string; area: LifeArea | 'other'; steps: string }

const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900'

/**
 * Share a whole path (the team's notes, October 2026): a name of its own
 * (e.g. "Model Madhu"), contributors, a short description, its categories,
 * norms and connection type to norm, its races with their steps, and the
 * people on it, by role. It waits for review before anyone else sees it.
 */
export default function ShareModelForm({
  open,
  onClose,
  onShared,
  categories,
  signedIn,
  defaultContributor,
}: {
  open: boolean
  onClose: () => void
  onShared: () => void
  categories: MarketCategory[]
  signedIn: boolean
  defaultContributor: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [contributors, setContributors] = useState('')
  const [description, setDescription] = useState('')
  const [keys, setKeys] = useState<string[]>([])
  const [norms, setNorms] = useState<string[]>([])
  const [connections, setConnections] = useState<string[]>([])
  const [races, setRaces] = useState<RaceRow[]>([{ name: '', area: 'education', steps: '' }])
  const [people, setPeople] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (open) {
      setDone(false)
      setError('')
      if (!contributors && defaultContributor) setContributors(defaultContributor)
      if (!dialog.current?.open) dialog.current?.showModal()
    } else if (dialog.current?.open) dialog.current.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const flip = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const raceList = races
      .map((r) => ({ name: r.name.trim(), area: r.area, milestones: r.steps.split('\n').map((s) => s.trim()).filter(Boolean) }))
      .filter((r) => r.name)
    if (name.trim().length < 2 || description.trim().length < 10 || !raceList.length || !keys.length) {
      setError('Add a name, a short description (10+ characters), at least one category and at least one race.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/path-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          contributors: contributors.split(',').map((c) => c.trim()).filter(Boolean),
          description: description.trim(),
          categoryKeys: keys,
          norms,
          connectionTypes: connections,
          races: raceList,
          people: people.split('\n').map((p) => p.trim()).filter(Boolean).map((role) => ({ role })),
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(j.error || 'Could not submit.')
        return
      }
      setDone(true)
      setName('')
      setDescription('')
      setKeys([])
      setNorms([])
      setConnections([])
      setRaces([{ name: '', area: 'education', steps: '' }])
      setPeople('')
      onShared()
    } finally {
      setSending(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      aria-labelledby="share-model-title"
      className="max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl bg-white p-0 backdrop:bg-black/50"
    >
      <div className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="share-model-title" className="text-lg font-bold text-slate-900">Share your path model</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-700 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        {done ? (
          <div className="py-6 text-center">
            <div className="mb-2 text-4xl" aria-hidden="true">🎉</div>
            <p className="font-semibold text-slate-900">Thanks for sharing!</p>
            <p className="mt-1 text-sm text-slate-700">Your model is <strong>waiting for review</strong>. You’ll see it with that label until it’s approved for everyone.</p>
            <button type="button" onClick={onClose} className="mt-4 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-slate-700">
              Share how you went through a part of life so others can start from your path. It can be one race and no people.
              {!signedIn && <span className="font-medium text-amber-800"> You’ll need to sign in.</span>}
            </p>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">{error}</p>}
            <label className="block text-sm font-semibold text-slate-900">
              Model name
              <input className={`${field} mt-1`} placeholder="e.g. Model Madhu" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              Contributors <span className="font-normal text-slate-700">(how each wants to be credited, separated by commas)</span>
              <input className={`${field} mt-1`} value={contributors} onChange={(e) => setContributors(e.target.value)} maxLength={300} />
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              Short description <span className="font-normal text-slate-700">(how this path differs from others)</span>
              <textarea className={`${field} mt-1`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">Categories</legend>
              <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
                {PATH_CATEGORIES.map((area) => (
                  <div key={area.id} className="mt-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{area.emoji} {area.label}</p>
                    {categories.filter((c) => c.lifeAreas.includes(area.id)).map((c) => (
                      <label key={`${area.id}-${c.key}`} className="flex items-center gap-2 py-0.5 text-sm text-slate-900">
                        <input type="checkbox" checked={keys.includes(c.key)} onChange={() => setKeys(flip(keys, c.key))} className="h-4 w-4" />
                        {c.title}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">Norms <span className="font-normal text-slate-700">(optional)</span></legend>
              <div className="mt-1 grid gap-x-4 sm:grid-cols-2">
                {NORM_GROUPS.map((g) => (
                  <div key={g.key} className="mt-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-700">{g.label}</p>
                    {g.norms.filter((n) => !n.id.endsWith('_other')).map((n) => (
                      <label key={n.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-900">
                        <input type="checkbox" checked={norms.includes(n.id)} onChange={() => setNorms(flip(norms, n.id))} className="h-4 w-4" />
                        {n.label}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-700">Connection type to norm</p>
              <div className="grid sm:grid-cols-2">
                {CONNECTION_TYPES.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 py-0.5 text-sm text-slate-900">
                    <input type="checkbox" checked={connections.includes(c.id)} onChange={() => setConnections(flip(connections, c.id))} className="h-4 w-4" />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-900">Races</legend>
              <p className="text-xs text-slate-700">A race is a goal, with the steps you took for it (one per line, first step first).</p>
              <div className="mt-2 space-y-3">
                {races.map((r, i) => (
                  <div key={i} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input aria-label={`Race ${i + 1}: goal`} placeholder="Goal, e.g. Get into a research program" className={`${field} min-w-0 flex-1`} value={r.name} onChange={(e) => setRaces(races.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={120} />
                      <select aria-label={`Race ${i + 1}: area`} className={`${field} w-auto`} value={r.area} onChange={(e) => setRaces(races.map((x, j) => (j === i ? { ...x, area: e.target.value as RaceRow['area'] } : x)))}>
                        {PATH_CATEGORIES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                        <option value="other">Other</option>
                      </select>
                      {races.length > 1 && (
                        <button type="button" onClick={() => setRaces(races.filter((_, j) => j !== i))} aria-label={`Remove race ${i + 1}`} className="rounded p-1 text-slate-700 hover:text-red-700"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                      )}
                    </div>
                    <textarea aria-label={`Race ${i + 1}: steps, one per line`} placeholder="Steps, one per line (optional)" rows={3} className={`${field} mt-2`} value={r.steps} onChange={(e) => setRaces(races.map((x, j) => (j === i ? { ...x, steps: e.target.value } : x)))} />
                  </div>
                ))}
                {races.length < 8 && (
                  <button type="button" onClick={() => setRaces([...races, { name: '', area: 'education', steps: '' }])} className="inline-flex items-center gap-1 text-sm font-semibold text-sky-800 underline underline-offset-2">
                    <Plus className="h-4 w-4" aria-hidden="true" /> Add a race
                  </button>
                )}
              </div>
            </fieldset>

            <label className="block text-sm font-semibold text-slate-900">
              People on this path <span className="font-normal text-slate-700">(optional; roles, not names, one per line, e.g. “Academic advisor”)</span>
              <textarea className={`${field} mt-1`} rows={2} value={people} onChange={(e) => setPeople(e.target.value)} />
            </label>

            <button type="submit" disabled={sending} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Submit model
            </button>
          </form>
        )}
      </div>
    </dialog>
  )
}
