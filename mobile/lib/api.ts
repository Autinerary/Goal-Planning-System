import { supabase } from './supabase'

/**
 * The existing FastAPI backend, unchanged. Mobile is a second client for the
 * same API the web apps already use — no new server, no fork of the agent
 * pipeline.
 */
export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE || 'https://goal-planning-app-mup2.onrender.com'

export interface CurrentTask {
  id: string
  name: string
  milestoneName: string
}

/**
 * The task the user is on right now — what the floating bubble shows.
 *
 * Two sources, because they live in different places:
 *   - the path itself comes from the backend, which returns the stored
 *     user_paths payload directly
 *   - completion lives in race_progress, read straight from Supabase. The web
 *     app gets this through a Next API route that does not exist on mobile.
 *
 * "Current" is the first milestone NOT marked completed — the same rule the
 * trail map uses, rather than the backend's `status` flag, which is always
 * the first milestone regardless of progress.
 */
export async function fetchCurrentTask(userId: string): Promise<CurrentTask | null> {
  // The path endpoint requires a session — it used to return anyone's
  // profile, barrierTypes and email included, to whoever knew their UUID.
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return null

  const res = await fetch(
    `${API_BASE}/api/onboarding/user/${encodeURIComponent(userId)}/path`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return null

  const payload = await res.json().catch(() => null)

  // Verified against the live endpoint: the stored payload has no
  // `pathPlanning` key. Milestones hang off each race, and tasks off each
  // day of the schedule. Guessing this shape would have shipped an app that
  // always showed "nothing to do".
  const milestones: any[] = (payload?.races || []).flatMap((r: any) => r?.milestones || [])
  if (milestones.length === 0) return null

  const { data: progress } = await supabase
    .from('race_progress')
    .select('milestone_id')
    .eq('user_id', userId)
    .eq('kind', 'completed')

  const done = new Set((progress || []).map((r: any) => String(r.milestone_id)))
  const next = milestones.find((m: any) => !done.has(String(m.id))) || milestones[0]

  const tasks: any[] = (payload?.schedule || []).flatMap((d: any) => d?.tasks || [])
  const firstTask = tasks.find((t: any) => t.milestoneId === next.id)

  return {
    id: String(firstTask?.id || next.id),
    name: String(firstTask?.name || firstTask?.title || next.name || 'Your next step'),
    milestoneName: String(next.name || ''),
  }
}


export interface Milestone {
  id: string
  name: string
  dimension: string
  dimensionLabel: string
  completed: boolean
}

/**
 * The user's whole path, as milestones with real completion state.
 *
 * Same two-source shape as fetchCurrentTask: the path comes from the backend
 * (verified against the live endpoint — milestones hang off races[], there is
 * no `pathPlanning` key despite the web app's naming), and completion comes
 * from race_progress in Supabase, which the web app reads through a Next API
 * route that does not exist on mobile.
 */
export async function fetchMilestones(userId: string): Promise<Milestone[]> {
  const { data: sess } = await supabase.auth.getSession()
  const token = sess.session?.access_token
  if (!token) return []

  const res = await fetch(
    `${API_BASE}/api/onboarding/user/${encodeURIComponent(userId)}/path`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return []

  const payload = await res.json().catch(() => null)
  const raw: any[] = (payload?.races || []).flatMap((r: any) => r?.milestones || [])
  if (raw.length === 0) return []

  const { data: progress } = await supabase
    .from('race_progress')
    .select('milestone_id')
    .eq('user_id', userId)
    .eq('kind', 'completed')

  const done = new Set((progress || []).map((r: any) => String(r.milestone_id)))

  return raw.map((m: any) => ({
    id: String(m.id),
    name: String(m.name || 'Milestone'),
    dimension: String(m.dimension || 'default'),
    dimensionLabel: String(m.dimensionLabel || ''),
    completed: done.has(String(m.id)),
  }))
}

/** Mark a milestone done, or undo it. Writes to the same race_progress table
 *  the web app uses, so progress is shared across every client. */
export async function setMilestoneComplete(
  userId: string,
  milestoneId: string,
  completed: boolean
): Promise<boolean> {
  try {
    if (completed) {
      const { error } = await supabase
        .from('race_progress')
        .upsert(
          { user_id: userId, milestone_id: milestoneId, kind: 'completed' },
          // Conflict target named explicitly, matching what the web app's
          // /api/me/progress already does in production — Postgres defaults
          // to the primary key otherwise, which is the wrong constraint.
          // ignoreDuplicates because the row is a marker with nothing to
          // update: re-completing should be a no-op, not an error.
          { onConflict: 'user_id,milestone_id,kind', ignoreDuplicates: true }
        )
      return !error
    }
    const { error } = await supabase
      .from('race_progress')
      .delete()
      .eq('user_id', userId)
      .eq('milestone_id', milestoneId)
      .eq('kind', 'completed')
    return !error
  } catch {
    return false
  }
}
