'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bookmark, CheckCircle2, ExternalLink, History, Loader2, Plus, Star, Trash2, Wrench } from 'lucide-react'
import { goHubHref } from '@/lib/serviceHub'
import {
  MAX_REACHED, MAX_TOOLS, STATUS_OPTIONS, canRate, cleanEdits, costLabel, hubPath, hubSearchPath, isToolStatus,
  nextStatus, resourceIdOf, toolKey, visibleTools, type PlanTool, type ToolEdits, type ToolStatus,
} from '@/lib/milestoneTools'
import type { ResourceLabels } from '@/lib/resourceLabels'
import { useSignups } from '@/lib/useSignups'
import SignupButton from './SignupButton'
import SignupDialogs from './SignupDialogs'

const SYMBOL: Record<string, string> = { service: '🔑', product: '👢', commentary: '🏋️', other: '🔨' }
const STATUS_ICON: Record<ToolStatus, typeof Bookmark> = { wishlist: Bookmark, current: CheckCircle2, past: History }
const STATUS_ON: Record<ToolStatus, string> = {
  wishlist: 'bg-amber-600 text-white border-amber-600',
  current: 'bg-green-700 text-white border-green-700',
  past: 'bg-indigo-700 text-white border-indigo-700',
}
const STATUS_OFF: Record<ToolStatus, string> = {
  wishlist: 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50',
  current: 'bg-white text-green-800 border-green-300 hover:bg-green-50',
  past: 'bg-white text-indigo-800 border-indigo-300 hover:bg-indigo-50',
}

// Saved statuses and ratings, read once per page however many lists there are.
let savedOnce: Promise<{ statuses: Record<string, string>; ratings: Record<string, number> }> | null = null
function loadSaved() {
  if (!savedOnce) {
    const get = (url: string): Promise<any> =>
      fetch(url, { cache: 'no-store', credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    savedOnce = Promise.all([get('/api/me/resource-status'), get('/api/me/resource-rating')])
      .then(([s, r]) => ({ statuses: s?.statuses || {}, ratings: r?.ratings || {} }))
  }
  return savedOnce
}

// Ratings of tools that aren't in ResourceHub stay on this device.
const LOCAL_RATINGS = 'milestoneToolRatings'
const readLocal = (): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(LOCAL_RATINGS) || '{}') || {} } catch { return {} }
}

function helpLines(tool: PlanTool): { category?: string; points: string[] }[] {
  if (Array.isArray(tool.helpsWith) && tool.helpsWith.length) {
    return tool.helpsWith.slice(0, 3).map((h) => ({ category: String(h.category || ''), points: (h.points || []).map(String).filter(Boolean).slice(0, 2) }))
  }
  const points = String(tool.description || '')
    .split(/(?<=[.;!?])\s+/)
    .map((s) => s.trim().replace(/[.;]+$/, ''))
    .filter(Boolean)
    .slice(0, 2)
  return points.length ? [{ points }] : []
}

/**
 * The tools recommended for one milestone (the team's notes on the Milestone
 * view, October 2026; lib/milestoneTools.ts): Wishlist, Currently Using and
 * Used, where the chosen one again clears it; "How well did it help" only
 * when Used, for that tool alone; each tool's ResourceHub labels; "View in
 * ResourceHub"; Remove (with Undo); "Recommend more" up to 5 for the
 * milestone; and "View these resources & more in ResourceHub" at the end.
 * With one-click sign-up on (lib/signups.ts), each service the kit knows has Sign me up.
 */
export default function MilestoneTools({
  milestoneId,
  milestoneName,
  baseTools,
  initialEdits,
  third,
  onRated,
  hubButton = true,
}: {
  milestoneId: string
  milestoneName: string
  baseTools: PlanTool[]
  initialEdits?: unknown
  /** Shown third, after two of the plan's own (a sponsored service). */
  third?: ReactNode
  /** Told when a used tool is rated (the Milestone view's "Categories addressed"). */
  onRated?: (tool: PlanTool, stars: number) => void
  /** The "View these resources & more in ResourceHub" button at the end. */
  hubButton?: boolean
}) {
  const [edits, setEdits] = useState<ToolEdits>(() => cleanEdits(initialEdits))
  const editsKey = JSON.stringify(initialEdits || null)
  useEffect(() => { setEdits(cleanEdits(initialEdits)) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestoneId, editsKey])

  const tools = useMemo(() => visibleTools(baseTools, edits), [baseTools, edits])
  const full = tools.length >= MAX_TOOLS

  // Statuses and ratings: ResourceHub's saved ones, then what is chosen here
  // (an explicit null is "none": it never falls back to the saved one, which
  // is how Wishlist and Currently Using used to swap instead of clearing).
  const [saved, setSaved] = useState<{ statuses: Record<string, string>; ratings: Record<string, number> }>({ statuses: {}, ratings: {} })
  const [statusOverride, setStatusOverride] = useState<Record<string, ToolStatus | null>>({})
  const [ratingOverride, setRatingOverride] = useState<Record<string, number>>({})
  useEffect(() => {
    let cancelled = false
    loadSaved().then((s) => { if (!cancelled) setSaved(s) })
    setRatingOverride((prev) => ({ ...readLocal(), ...prev }))
    return () => { cancelled = true }
  }, [])
  const statusOf = (tool: PlanTool): ToolStatus | null => {
    const key = toolKey(tool)
    if (key in statusOverride) return statusOverride[key]
    const s = saved.statuses[resourceIdOf(tool) || '']
    return isToolStatus(s) ? s : null
  }
  const ratingOf = (tool: PlanTool): number => {
    const key = toolKey(tool)
    if (key in ratingOverride) return ratingOverride[key]
    return saved.ratings[resourceIdOf(tool) || ''] || 0
  }

  // ResourceHub's labels for the tools on the list.
  const [labels, setLabels] = useState<Record<string, ResourceLabels>>({})
  const ids = tools.map(resourceIdOf).filter((x): x is string => !!x)
  const idsKey = ids.join(',')
  const signups = useSignups(ids)
  useEffect(() => {
    const need = ids.filter((id) => !labels[id])
    if (!need.length) return
    let cancelled = false
    fetch(`/api/resources/labels?ids=${need.join(',')}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.labels) setLabels((prev) => ({ ...prev, ...j.labels })) })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [undo, setUndo] = useState<PlanTool | null>(null)
  const statusSaves = useRef<Record<string, Promise<unknown>>>({})

  const chooseStatus = (tool: PlanTool, clicked: ToolStatus) => {
    const key = toolKey(tool)
    const before = statusOf(tool)
    const next = nextStatus(before, clicked)
    setStatusOverride((prev) => ({ ...prev, [key]: next }))
    setNote(next ? `${tool.name}: ${STATUS_OPTIONS.find((o) => o.id === next)?.label}.` : `${tool.name}: cleared.`)
    statusSaves.current[key] = fetch('/api/me/resource-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ resourceId: resourceIdOf(tool), name: tool.name, url: tool.url, status: next }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (res && res.ok === false && res.reason === 'not_in_resourcehub' && next) {
          setStatusOverride((prev) => ({ ...prev, [key]: before }))
          setNote(`“${tool.name}” isn’t in ResourceHub yet, so it can’t be added to your lists there.`)
        }
      })
      .catch(() => {})
  }

  const rate = async (tool: PlanTool, stars: number) => {
    const key = toolKey(tool)
    const value = ratingOf(tool) === stars ? 0 : stars
    setRatingOverride((prev) => ({ ...prev, [key]: value }))
    setNote(value ? `${tool.name}: ${value} out of 5.` : `${tool.name}: rating cleared.`)
    const rid = resourceIdOf(tool)
    if (!rid) {
      try { localStorage.setItem(LOCAL_RATINGS, JSON.stringify({ ...readLocal(), [key]: value })) } catch {}
    } else if (value) {
      // "Used" is saved first: that is what lets ResourceHub take the rating (can_rate()).
      await statusSaves.current[key]?.catch(() => {})
      const res = await fetch('/api/me/resource-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resourceId: rid, score: value }),
      }).catch(() => null)
      if (res && res.status === 403) setNote('Saved here. ResourceHub takes ratings from people who used a service: mark it Used, or add it to your team there.')
    }
    if (value) onRated?.(tool, value)
  }

  const change = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/me/path/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ milestoneId, ...body }),
    }).catch(() => null)
    const j = await res?.json().catch(() => null)
    if (j?.edits) setEdits(cleanEdits(j.edits))
    return { ok: !!res?.ok, j }
  }

  const remove = async (tool: PlanTool) => {
    setBusy(toolKey(tool))
    const { ok, j } = await change({ action: 'remove', key: toolKey(tool) })
    setBusy(null)
    if (ok) {
      setUndo(tool)
      setNote(`Removed “${tool.name}”.`)
    } else setNote(j?.error || 'That didn’t work. Try again.')
  }

  const restore = async () => {
    if (!undo) return
    setBusy('undo')
    const { ok, j } = await change({ action: 'restore', key: toolKey(undo) })
    setBusy(null)
    setNote(ok ? `“${undo.name}” is back.` : j?.error || 'That didn’t work. Try again.')
    if (ok) setUndo(null)
  }

  const more = async () => {
    if (full) { setNote(MAX_REACHED); return }
    setBusy('more')
    const { ok, j } = await change({ action: 'more' })
    setBusy(null)
    if (j?.added) setNote(`Added “${j.added.name}”.`)
    else if (j?.full || j?.error === MAX_REACHED) setNote(MAX_REACHED)
    else setNote(j?.message || (ok ? 'Nothing else in ResourceHub matches this milestone yet.' : j?.error || 'That didn’t work. Try again.'))
  }

  const headingId = `tools-${milestoneId}`
  const cards = [...tools.slice(0, 2), ...(third && tools.length >= 2 ? [null] : []), ...tools.slice(2)]

  return (
    <section aria-labelledby={headingId} data-milestone-tools={milestoneId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Wrench className="h-5 w-5" aria-hidden="true" /> Recommended Tools to use
        </h2>
        <span className="text-sm font-semibold text-slate-700">{tools.length} of {MAX_TOOLS}</span>
      </div>

      {tools.length === 0 && (
        <p className="mt-3 text-sm text-slate-700">No tools on this milestone yet. Ask for one with Recommend more.</p>
      )}

      <ul className="mt-3 space-y-3">
        {cards.map((tool) => {
          if (!tool) return <li key="third">{third}</li>
          const key = toolKey(tool)
          const status = statusOf(tool)
          const rating = ratingOf(tool)
          const rid = resourceIdOf(tool)
          const l = rid ? labels[rid] : undefined
          const cost = l?.cost || costLabel(tool)
          const chips = [l?.kind || (tool.type === 'product' ? 'Product' : tool.type === 'commentary' ? 'Commentary' : 'Service'), l?.type || tool.category || null, ...(l?.tags || []), cost, ...(l?.ages || [])]
            .filter((c, i, a): c is string => !!c && a.indexOf(c) === i)
          return (
            <li key={key} className={`rounded-xl border-2 p-4 ${status ? 'border-green-300 bg-green-50' : 'border-amber-200 bg-white'}`}>
              <div className="flex items-start gap-3">
                <span className="text-2xl" aria-hidden="true">{SYMBOL[tool.type || 'other'] || '🔧'}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-slate-900">
                    {tool.name}
                    {tool.added && <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">Added by you</span>}
                  </h3>
                  {/* ResourceHub's labels for it. */}
                  <ul className="mt-1 flex flex-wrap gap-1" aria-label="Labels in ResourceHub">
                    {chips.map((c) => (
                      <li key={c} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-800">{c}</li>
                    ))}
                  </ul>
                  {l && l.norms.length > 0 && (
                    <p className="mt-1 text-xs text-slate-800"><span className="font-semibold">Norms (from ratings):</span> {l.norms.join(', ')}</p>
                  )}
                </div>
              </div>

              {helpLines(tool).length > 0 && (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 p-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-900">What this helps with</p>
                  {helpLines(tool).map((g, i) => (
                    <div key={i} className="mt-1">
                      {g.category && <p className="text-sm font-semibold text-slate-900">{g.category}</p>}
                      <ul className="mt-0.5 space-y-0.5">
                        {g.points.map((p) => (
                          <li key={p} className="flex gap-1.5 text-xs text-slate-800"><span className="text-amber-700" aria-hidden="true">•</span>{p}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Your status for ${tool.name}`}>
                {STATUS_OPTIONS.map((o) => {
                  const Icon = STATUS_ICON[o.id]
                  const on = status === o.id
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => chooseStatus(tool, o.id)}
                      className={`inline-flex min-h-[32px] items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${on ? STATUS_ON[o.id] : STATUS_OFF[o.id]}`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {o.label}
                    </button>
                  )
                })}
                </div>
                <span className="ml-auto flex flex-wrap items-center gap-3">
                  <SignupButton app={signups} service={(rid && signups.listings[rid]) || signups.serviceFor(tool.url) || signups.requestFor(rid)} resourceId={rid} compact />
                  <a href={goHubHref(hubPath(tool))} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-800 underline underline-offset-2">
                    View in ResourceHub <ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => remove(tool)}
                    disabled={busy === key}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 underline underline-offset-2 hover:text-red-700 disabled:opacity-50"
                    aria-label={`Remove ${tool.name} from this milestone`}
                  >
                    <Trash2 className="h-3 w-3" aria-hidden="true" /> Remove
                  </button>
                </span>
              </div>

              {/* Asked only once it has been used (the team's notes). */}
              {canRate(status) && (
                <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-amber-100 pt-3" role="group" aria-label={`How well did ${tool.name} help?`}>
                  <span className="mr-1 text-xs font-semibold text-slate-800">How well did it help?</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => rate(tool, n)}
                      aria-pressed={rating === n}
                      aria-label={`${n} out of 5`}
                      className="rounded p-1"
                    >
                      <Star className={`h-4 w-4 ${n <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-400 hover:text-amber-400'}`} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {full ? (
          <p className="text-sm font-semibold text-slate-800" data-max-reached>{MAX_REACHED}</p>
        ) : (
          <button
            type="button"
            onClick={more}
            disabled={busy === 'more'}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-60"
          >
            {busy === 'more' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
            Recommend more
          </button>
        )}
        {undo && (
          <button type="button" onClick={restore} disabled={busy === 'undo'} className="text-sm font-semibold text-sky-800 underline underline-offset-2">
            Undo removing “{undo.name}”
          </button>
        )}
      </div>
      <p className="mt-2 min-h-[1.25rem] text-sm text-slate-800" role="status" aria-live="polite">{note}</p>
      {signups.on && (
        <>
          <p className="min-h-[1.25rem] text-sm text-slate-900" role="status" aria-live="polite" data-signup-note>{signups.note}</p>
          <SignupDialogs app={signups} />
        </>
      )}

      {hubButton && <HubButton milestoneName={milestoneName} />}
    </section>
  )
}

/** "View these resources & more in ResourceHub" (the team's notes). */
export function HubButton({ milestoneName }: { milestoneName: string }) {
  return (
    <a
      href={goHubHref(hubSearchPath(milestoneName))}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
    >
      <ExternalLink className="h-4 w-4" aria-hidden="true" /> View these resources &amp; more in ResourceHub
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

