'use client'

import { useEffect, useMemo, useState } from 'react'
import { backendAuthHeaders } from '@/lib/backendAuth'
import { loadPreferences } from '@/lib/preferences'
import { guidanceComplete } from '@/lib/guidanceData'
import { withOwnModel } from '@/lib/ownModelRoute'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// One request per plan and set of steps, however many parts of a page ask.
const inflight = new Map<string, Promise<Record<string, unknown> | null>>()
// Why guidance wasn't written, when it's the person's own model that wasn't ready (said on the page).
const whyNot = new Map<string, string>()

/**
 * What to avoid and what helps at each of these steps (lib/guidanceData.ts):
 * from the plan when it has them, otherwise written once by the backend
 * (POST /api/paths/me/guidance) and kept in the plan. Read an entry with
 * guidanceFor(guidance, id, name).
 */
export function useMilestoneGuidance(
  payload: { id?: string; milestoneGuidance?: unknown } | null | undefined,
  milestones: ReadonlyArray<{ id: string; name: string }>,
  enabled = true,
) {
  const stored = payload?.milestoneGuidance
  const complete = guidanceComplete(stored, milestones)
  const key = `${payload?.id || ''}:${milestones.map((m) => `${m.id}=${m.name}`).join('|')}`
  const [fetched, setFetched] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [why, setWhy] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || complete || !payload || milestones.length === 0) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    let request = inflight.get(key)
    if (!request) {
      request = (async () => {
        whyNot.delete(key)
        try {
          const auth = await backendAuthHeaders()
          if (!auth.Authorization) return null
          const body = { languageStyle: loadPreferences().languageStyle || null }
          // On the person's own model when "Use my own model" is on (lib/ownModelRoute.ts): in the background, so
          // nothing is asked, and if their model isn't ready it isn't written, and the page says why.
          const j: any = await withOwnModel('guidance', body, async () => {
            const res = await fetch(`${API_URL}/api/paths/me/guidance`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...auth },
              body: JSON.stringify(body),
            })
            return res.ok ? res.json() : null
          }, { ask: false })
          return j?.guidance && typeof j.guidance === 'object' ? (j.guidance as Record<string, unknown>) : null
        } catch (e: any) {
          if (e?.ownModel) whyNot.set(key, String(e.message))
          return null
        }
      })()
      inflight.set(key, request)
      // A failed answer can be asked for again later.
      request.then((g) => { if (!g) inflight.delete(key) })
    }
    request.then((g) => {
      if (cancelled) return
      setFetched(g)
      setFailed(!g)
      setWhy(g ? null : whyNot.get(key) ?? null)
      setLoading(false)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, complete, key])

  const guidance = useMemo(
    () => ({ ...((stored as Record<string, unknown>) || {}), ...(fetched || {}) }),
    [stored, fetched],
  )
  return { guidance, loading: loading && !complete, failed: failed && !complete, why: failed && !complete ? why : null }
}
