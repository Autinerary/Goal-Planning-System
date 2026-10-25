'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  APPLY_ON, UNDO_SECONDS, type ApplicationDetails, type ApplicationStatus, type ApplyHow,
} from '@/lib/applications'

/**
 * One-click Apply on a page (lib/applications.ts): where each listing's
 * application is, the person's saved details, and the actions. Apply on one
 * service waits UNDO_SECONDS so it can be taken back, then sends; "Apply
 * all" sends at once after its own confirmation. The first time, either
 * asks for the details (`asking`) and carries on once they're saved.
 */

export interface ApplyState {
  how: ApplyHow
  status: ApplicationStatus | null
  at: string | null
  name?: string
  phone?: string | null
}

export interface ApplyResult {
  resourceId: string
  outcome: 'sent' | 'waiting' | 'done' | 'none' | 'failed' | 'limit' | 'missing'
  status: ApplicationStatus | null
  at: string | null
  error?: string
}

type Source = 'task' | 'milestone' | 'apply_page'

interface Info {
  on: boolean
  ready: boolean
  refusal: string | null
  email: string | null
  details: ApplicationDetails | null
  defaults: ApplicationDetails | null
}

export function useApplications(resourceIds: string[], source: Source) {
  const key = [...new Set(resourceIds.filter(Boolean))].sort().join(',')
  const [info, setInfo] = useState<Info>({ on: APPLY_ON, ready: false, refusal: null, email: null, details: null, defaults: null })
  const [states, setStates] = useState<Record<string, ApplyState>>({})
  const [loaded, setLoaded] = useState(false)
  // Seconds left before each pending Apply goes, by resource (shown), and
  // when each goes (kept in a ref, so a re-render never sends twice).
  const [pending, setPending] = useState<Record<string, number>>({})
  const deadlines = useRef<Record<string, number>>({})
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null)
  // Asking for the details first: what to do once they're saved.
  const [asking, setAsking] = useState<{ ids: string[]; serviceName: string; then: 'undo' | 'now' | 'none' } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!APPLY_ON) return
    const r = await fetch(`/api/me/applications?ids=${encodeURIComponent(key)}`, { cache: 'no-store', credentials: 'include' }).catch(() => null)
    const j = await r?.json().catch(() => null)
    if (j) {
      setInfo({ on: !!j.on, ready: !!j.ready, refusal: j.refusal || null, email: j.email || null, details: j.details || null, defaults: j.defaults || null })
      setStates(j.states || {})
    }
    setLoaded(true)
  }, [key])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => () => {
    if (ticker.current) clearInterval(ticker.current)
  }, [])

  const send = useCallback(
    async (ids: string[]): Promise<ApplyResult[]> => {
      setBusy(true)
      const r = await fetch('/api/me/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resourceIds: ids, source }),
      }).catch(() => null)
      const j = await r?.json().catch(() => null)
      setBusy(false)
      if (!r?.ok) {
        if (j?.needDetails) setAsking({ ids, serviceName: states[ids[0]]?.name || '', then: 'now' })
        setNote(j?.error || 'That didn’t send. Try again.')
        return []
      }
      const results: ApplyResult[] = j.results || []
      setStates((prev) => {
        const next = { ...prev }
        for (const res of results) {
          if (next[res.resourceId] && res.status) next[res.resourceId] = { ...next[res.resourceId], status: res.status, at: res.at }
        }
        return next
      })
      setNote(summary(results, states))
      return results
    },
    [source, states],
  )

  // The latest send, for the countdown's timer.
  const sendRef = useRef(send)
  sendRef.current = send

  const tick = useCallback(() => {
    const now = Date.now()
    const due: string[] = []
    const left: Record<string, number> = {}
    for (const [id, at] of Object.entries(deadlines.current)) {
      if (at <= now) {
        due.push(id)
        delete deadlines.current[id]
      } else left[id] = Math.ceil((at - now) / 1000)
    }
    setPending(left)
    if (!Object.keys(deadlines.current).length && ticker.current) {
      clearInterval(ticker.current)
      ticker.current = null
    }
    for (const id of due) void sendRef.current([id])
  }, [])

  /** Apply to one: a few seconds to take it back, then it goes. */
  const startUndoable = useCallback(
    (id: string) => {
      if (deadlines.current[id]) return
      deadlines.current[id] = Date.now() + UNDO_SECONDS * 1000
      setPending((p) => ({ ...p, [id]: UNDO_SECONDS }))
      setNote(`Sending to ${states[id]?.name || 'this service'} in ${UNDO_SECONDS} seconds. Press Undo to stop it.`)
      if (!ticker.current) ticker.current = setInterval(tick, 250)
    },
    [states, tick],
  )

  const undo = useCallback((id: string) => {
    delete deadlines.current[id]
    setPending(({ [id]: _gone, ...rest }) => rest)
    setNote('Stopped. Nothing was sent.')
  }, [])

  /** Apply on one service. */
  const apply = useCallback(
    (id: string, serviceName: string) => {
      if (info.refusal) { setNote(info.refusal); return }
      if (!info.details) { setAsking({ ids: [id], serviceName, then: 'undo' }); return }
      startUndoable(id)
    },
    [info.details, info.refusal, startUndoable],
  )

  /** "Apply all": the page asks first, then calls this. */
  const applyAll = useCallback(
    async (ids: string[]) => {
      if (info.refusal) { setNote(info.refusal); return [] }
      if (!info.details) { setAsking({ ids, serviceName: '', then: 'now' }); return [] }
      return send(ids)
    },
    [info.details, info.refusal, send],
  )

  /** Take back one that is still waiting for an address. */
  const cancel = useCallback(async (id: string) => {
    const r = await fetch(`/api/me/applications?resourceId=${id}`, { method: 'DELETE', credentials: 'include' }).catch(() => null)
    const j = await r?.json().catch(() => null)
    if (r?.ok) {
      setStates((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], status: 'cancelled' } } : prev))
      setNote('Taken back. Nothing will be sent.')
    } else setNote(j?.error || 'That didn’t work. Try again.')
  }, [])

  /** The details were saved (or changed): carry on with what was asked. */
  const detailsSaved = useCallback(
    (details: ApplicationDetails | null) => {
      setInfo((prev) => ({ ...prev, details }))
      const was = asking
      setAsking(null)
      if (!details || !was) return
      if (was.then === 'undo' && was.ids[0]) setTimeout(() => startUndoable(was.ids[0]), 0)
      if (was.then === 'now' && was.ids.length) setTimeout(() => void send(was.ids), 0)
    },
    [asking, send, startUndoable],
  )

  return {
    on: info.on && APPLY_ON,
    ready: info.ready,
    loaded,
    refusal: info.refusal,
    email: info.email,
    details: info.details,
    defaults: info.defaults,
    states,
    pending,
    asking,
    note,
    busy,
    setNote,
    apply,
    applyAll,
    undo,
    cancel,
    /** Open the details to change them (no Apply after). */
    editDetails: () => setAsking({ ids: [], serviceName: '', then: 'none' }),
    closeDetails: () => setAsking(null),
    detailsSaved,
    reload: load,
  }
}

export type Applications = ReturnType<typeof useApplications>

const list = (names: string[]): string =>
  names.length <= 1 ? names[0] || '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/** What happened, in a sentence or two, for the page's live note. */
export function summary(results: ApplyResult[], states: Record<string, ApplyState>): string {
  const name = (id: string) => states[id]?.name || 'a service'
  const of = (o: ApplyResult['outcome']) => results.filter((r) => r.outcome === o).map((r) => name(r.resourceId))
  const parts: string[] = []
  const sent = of('sent')
  const waiting = of('waiting')
  const failed = of('failed')
  const limit = of('limit')
  if (sent.length) parts.push(`Sent to ${list(sent)}. Replies come to your email, and you have a copy.`)
  if (waiting.length) parts.push(`${list(waiting)} ${waiting.length === 1 ? 'has' : 'have'} no email address yet: your application goes out as soon as we find one.`)
  if (failed.length) parts.push(`${list(failed)}: it didn’t send. Try again.`)
  if (limit.length) parts.push(`That’s the most for one day. ${list(limit)} can wait until tomorrow.`)
  if (!parts.length) parts.push('Nothing new to send: you’ve already applied to these.')
  return parts.join(' ')
}
