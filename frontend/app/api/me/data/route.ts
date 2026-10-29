import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withoutOtherPeople } from '@/lib/pathPrivacy'

/**
 * Data & Progress management for the signed-in user.
 *
 *   GET  /api/me/data                     -> full backup of the user's data (JSON)
 *   POST /api/me/data  { scope }          -> reset ('progress') or wipe ('all')
 *   PUT  /api/me/data  { backup }         -> restore rows from a backup JSON
 *
 * Auth is verified with the cookie-based client; the actual table operations
 * use the service-role admin client so we can also touch `user_paths` (which
 * has RLS enabled with no policies). Every operation is hard-scoped to the
 * caller's own user_id — a backup can never write another user's rows.
 */

const BACKUP_VERSION = 2

// Tables that make up "progress" (cleared by both reset + full wipe).
const PROGRESS_TABLES = [
  'race_progress',
  'calendar_tasks',
  'life_stats_snapshots',
  'life_stats_checkins',
  'ideal_self_portraits',
] as const

// The generated plan. Only wiped on a full restart.
const PLAN_TABLE = 'user_paths'
// Private account-level personalization data. Included in backups and removed
// on a full restart, but preserved when the user resets progress only.
const PRIVATE_PROFILE_TABLES = ['user_diagnostic_profiles'] as const

const ALL_TABLES = [...PROGRESS_TABLES, PLAN_TABLE, ...PRIVATE_PROFILE_TABLES] as const
// In the download, so you have everything you saved, but not restored and not
// cleared by starting over: your moments (their captions and which task or
// milestone; the photos and videos stay in Memories), notes to yourself, and
// your Relationships profile (STEP 87); and the services Sign me up signed
// you up for (STEP 90: an account made stays made).
const EXPORT_ONLY_TABLES = ['moments', 'future_notes', 'match_profiles', 'service_signups'] as const
// Made from the plan by the database (STEP 92): which steps each version of
// your plan had, in categories and numbers only. In the download and cleared
// by starting over; never restored (saving the plan records it again).
const PLAN_RECORD_TABLES = ['plan_step_history'] as const

// Per-table conflict targets used when restoring.
const CONFLICT: Record<string, string> = {
  race_progress: 'user_id,milestone_id,kind',
  calendar_tasks: 'user_id,client_id',
  life_stats_snapshots: 'user_id,snapshot_date',
  life_stats_checkins: 'user_id,checkin_date',
  ideal_self_portraits: 'user_id',
  user_paths: 'user_id',
  user_diagnostic_profiles: 'user_id',
}

async function requireUser() {
  const supabase = createServerSupabase()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

// ── GET: export everything ────────────────────────────────────────────
export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const admin = createAdminClient()
  const tables: Record<string, any[]> = {}

  for (const table of [...ALL_TABLES, ...EXPORT_ONLY_TABLES, ...PLAN_RECORD_TABLES]) {
    try {
      const { data, error } = await admin.from(table).select('*').eq('user_id', user.id)
      if (error) {
        console.warn(`backup: skipped ${table}:`, error.message)
        tables[table] = []
      } else if (table === PLAN_TABLE) {
        // A backup holds the person's own data, not the other people their
        // plan was matched with (lib/pathPrivacy.ts).
        tables[table] = (data || []).map((row: any) => ({ ...row, payload: withoutOtherPeople(row.payload) }))
      } else {
        tables[table] = data || []
      }
    } catch (e: any) {
      console.warn(`backup: ${table} threw:`, e?.message ?? e)
      tables[table] = []
    }
  }

  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    userId: user.id,
    tables,
  }

  return NextResponse.json({ backup })
}

// ── POST: reset (progress) or full wipe (all) ─────────────────────────
export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const scope = body?.scope === 'all' ? 'all' : 'progress'
  const targets = scope === 'all' ? [...ALL_TABLES, ...PLAN_RECORD_TABLES] : PROGRESS_TABLES

  const admin = createAdminClient()
  const cleared: string[] = []
  const skipped: string[] = []

  for (const table of targets) {
    try {
      const { error } = await admin.from(table).delete().eq('user_id', user.id)
      if (error) {
        console.warn(`reset: skipped ${table}:`, error.message)
        skipped.push(table)
      } else {
        cleared.push(table)
      }
    } catch (e: any) {
      console.warn(`reset: ${table} threw:`, e?.message ?? e)
      skipped.push(table)
    }
  }

  return NextResponse.json({ ok: true, scope, cleared, skipped })
}

// ── PUT: restore from a backup ────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const backup = body?.backup
  if (!backup || typeof backup !== 'object' || !backup.tables || typeof backup.tables !== 'object') {
    return NextResponse.json({ error: 'A valid backup object is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const restored: Record<string, number> = {}
  const skipped: string[] = []

  for (const table of ALL_TABLES) {
    const rows = backup.tables[table]
    if (!Array.isArray(rows) || rows.length === 0) continue

    // Force ownership to the current user — a backup can only ever restore into
    // the caller's own account, never someone else's.
    const scoped = rows.map((r: any) => ({ ...r, user_id: user.id }))

    try {
      const { error } = await admin
        .from(table)
        .upsert(scoped, { onConflict: CONFLICT[table] || 'user_id' })
      if (error) {
        console.warn(`restore: skipped ${table}:`, error.message)
        skipped.push(table)
      } else {
        restored[table] = scoped.length
      }
    } catch (e: any) {
      console.warn(`restore: ${table} threw:`, e?.message ?? e)
      skipped.push(table)
    }
  }

  return NextResponse.json({ ok: true, restored, skipped })
}

export const dynamic = 'force-dynamic'
