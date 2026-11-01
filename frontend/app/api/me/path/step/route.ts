import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { activePathRow, updateActivePath } from '@/lib/activePath'
import { cleanStepText, stepCopies, withStepEdit, withStepRestored } from '@/lib/stepEdits'

export const dynamic = 'force-dynamic'

/**
 * A step of the plan in the person's own words (the step's page, "Put this step in your own words"):
 *   POST { milestoneId, name, description }   save it in their words, everywhere the plan keeps the step
 *   POST { milestoneId, action: 'restore' }   put the planner's version back
 * The planner's version is kept (payload.stepEdits, lib/stepEdits.ts). Edited steps can go into the person's
 * training set (Settings, Models, Build my training set).
 */
export async function POST(req: NextRequest) {
  const supabase = createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const milestoneId = typeof body?.milestoneId === 'string' ? body.milestoneId.slice(0, 200) : ''
  if (!milestoneId) return NextResponse.json({ error: 'Say which step.' }, { status: 400 })
  const restore = body?.action === 'restore'
  const text = restore ? null : cleanStepText(body?.name, body?.description)
  if (text && 'error' in text) return NextResponse.json({ error: text.error }, { status: 400 })

  const admin = createAdminClient()
  const row = await activePathRow(admin, user.id)
  if (!row) return NextResponse.json({ error: 'No plan yet.' }, { status: 404 })
  if (!stepCopies(row.payload, milestoneId).length) return NextResponse.json({ error: 'That step isn’t in your plan.' }, { status: 404 })

  let changed = false
  const saved = await updateActivePath(admin, user.id, row.path_id, (payload) => {
    const next = restore ? withStepRestored(payload, milestoneId) : withStepEdit(payload, milestoneId, text as { name: string; description: string })
    changed = !!next
    return next ?? payload
  })
  if (!saved) return NextResponse.json({ error: 'Your plan changed meanwhile. Please try again.' }, { status: 409 })
  const step = stepCopies(saved, milestoneId)[0]
  return NextResponse.json({
    name: step?.name ?? '',
    description: step?.description ?? '',
    edited: !!saved.stepEdits?.[milestoneId],
    changed,
  })
}
