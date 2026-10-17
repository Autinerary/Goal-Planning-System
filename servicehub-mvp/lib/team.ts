/**
 * Building a team in three clicks (the team's planning note, October 2026,
 * "Ex. Preferred Service"):
 *
 *   1. What I want → Enter → a list of matching services (lib/search/understand.ts)
 *   2. Which one I like → "Add to my team": on the team, with a first meeting
 *      to book in the Autinerary calendar
 *   3. "Sign them on" → done
 *
 * A team member is a saved_resources row: 'wishlist' while it is being
 * arranged (calls_scheduled: a first meeting is booked or to be booked) and
 * 'current' once signed on (added_to_team_at). The meeting is a calendar task
 * the person can move or tick off in the app; nobody else's calendar is
 * touched, and nothing is sent to the service.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type TeamState = 'none' | 'saved' | 'meeting' | 'signed'

export interface Meeting {
  /** YYYY-MM-DD, the person's own date. */
  date: string
  /** The weekday's name, as the calendar keeps it ('Monday'). */
  day: string
  /** HH:MM. */
  time: string
}

/** The calendar task for a team member's first meeting. One per service. */
export const meetingTaskId = (resourceId: string) => `team-meet-${resourceId}`

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The next weekday after `from`, at 10:00, in the person's own time (run it in the browser). */
export function nextMeeting(from = new Date()): Meeting {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, day: WEEKDAYS[d.getDay()], time: '10:00' }
}

export function isMeeting(m: unknown): m is Meeting {
  const x = m as Meeting
  return (
    !!x &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) &&
    WEEKDAYS.includes(String(x.day)) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(String(x.time))
  )
}

// Before STEP 77 the team columns may be missing; everything still works,
// with the meeting kept only in the calendar.
const missingColumn = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === '42703' || error.code === 'PGRST204' || /calls_scheduled|added_to_team_at/.test(error.message || ''))

type Row = { resource_id: string; status: string; calls_scheduled?: boolean | null }

const stateOf = (row: Row | undefined): TeamState =>
  !row ? 'none' : row.status === 'current' ? 'signed' : row.calls_scheduled ? 'meeting' : 'saved'

/** Where each of these services is on the person's team. */
export async function teamStates(supabase: SupabaseClient, userId: string, ids: string[]): Promise<Record<string, TeamState>> {
  if (ids.length === 0) return {}
  let rows: Row[] = []
  const withFlag = await supabase.from('saved_resources').select('resource_id, status, calls_scheduled').eq('user_id', userId).in('resource_id', ids)
  if (missingColumn(withFlag.error)) {
    const plain = await supabase.from('saved_resources').select('resource_id, status').eq('user_id', userId).in('resource_id', ids)
    rows = (plain.data as Row[]) || []
  } else {
    rows = (withFlag.data as Row[]) || []
  }
  const out: Record<string, TeamState> = {}
  for (const row of rows) if (row.status !== 'past') out[row.resource_id] = stateOf(row)
  return out
}

/**
 * "Add to my team": the service on the team, a first meeting to book in the
 * calendar. Returns whether the saved row is new (so Undo can remove it).
 */
export async function addToTeam(
  supabase: SupabaseClient,
  userId: string,
  resource: { id: string; name: string },
  meeting: Meeting | null
): Promise<{ state: TeamState; created: boolean; meeting: Meeting | null }> {
  const { data: existing } = await supabase
    .from('saved_resources')
    .select('id, status')
    .eq('user_id', userId)
    .eq('resource_id', resource.id)
    .maybeSingle()
  if (existing?.status === 'current') return { state: 'signed', created: false, meeting: null }

  if (existing) {
    // Saved before, or used in the past: back to being arranged.
    let res = await supabase.from('saved_resources').update({ status: 'wishlist', calls_scheduled: true }).eq('id', existing.id)
    if (missingColumn(res.error)) res = await supabase.from('saved_resources').update({ status: 'wishlist' }).eq('id', existing.id)
    if (res.error) throw res.error
  } else {
    let res = await supabase.from('saved_resources').insert({ user_id: userId, resource_id: resource.id, status: 'wishlist', calls_scheduled: true })
    if (missingColumn(res.error)) res = await supabase.from('saved_resources').insert({ user_id: userId, resource_id: resource.id, status: 'wishlist' })
    if (res.error) throw res.error
  }

  let booked: Meeting | null = null
  if (meeting) {
    const { error } = await supabase.from('calendar_tasks').upsert(
      {
        user_id: userId,
        client_id: meetingTaskId(resource.id),
        day: meeting.day,
        time: meeting.time,
        scheduled_date: meeting.date,
        name: `Contact ${resource.name.slice(0, 150)} to book a first meeting`,
        duration: '15 min',
        duration_minutes: 15,
        priority: 'high',
        source: 'ResourceHub',
        completed: false,
        completed_at: null,
      },
      { onConflict: 'user_id,client_id' }
    )
    if (error) console.error('team: could not add the meeting to the calendar:', error.message)
    else booked = meeting
  }
  return { state: 'meeting', created: !existing, meeting: booked }
}

/** Undo "Add to my team": the meeting task goes, and the row if it was new. */
export async function undoAddToTeam(supabase: SupabaseClient, userId: string, resourceId: string, created: boolean): Promise<TeamState> {
  const { data: row } = await supabase.from('saved_resources').select('id, status').eq('user_id', userId).eq('resource_id', resourceId).maybeSingle()
  if (row?.status === 'current') return 'signed'
  await supabase.from('calendar_tasks').delete().eq('user_id', userId).eq('client_id', meetingTaskId(resourceId))
  if (!row) return 'none'
  if (created) {
    const { error } = await supabase.from('saved_resources').delete().eq('id', row.id)
    if (error) throw error
    return 'none'
  }
  const res = await supabase.from('saved_resources').update({ calls_scheduled: false }).eq('id', row.id)
  if (res.error && !missingColumn(res.error)) throw res.error
  return 'saved'
}

/** "Sign them on" ticks off the meeting task; "Undo" puts it back. */
export async function markMeetingDone(supabase: SupabaseClient, userId: string, resourceId: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('calendar_tasks')
    .update({ completed: done, completed_at: done ? new Date().toISOString() : null })
    .eq('user_id', userId)
    .eq('client_id', meetingTaskId(resourceId))
  if (error) console.error('team: could not update the meeting task:', error.message)
}
