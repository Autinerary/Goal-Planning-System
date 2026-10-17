import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addToTeam, isMeeting, teamStates, undoAddToTeam } from '@/lib/team'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/team  { resourceId, meeting?: { date, day, time } }
 *   "Add to my team" (lib/team.ts): on the team, with a first meeting to book
 *   in the Autinerary calendar on the date the browser chose.
 * DELETE /api/team?resourceId=&created=1
 *   Undo it.
 * GET /api/team?ids=a,b,c
 *   Where each of these services is on the person's team.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to add services to your team.' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const resourceId = String(body?.resourceId || '')
  if (!UUID.test(resourceId)) return NextResponse.json({ error: 'Which service?' }, { status: 400 })

  const { data: resource } = await supabase.from('resources').select('id, name').eq('id', resourceId).maybeSingle()
  if (!resource) return NextResponse.json({ error: 'That service could not be found.' }, { status: 404 })

  try {
    const result = await addToTeam(supabase, user.id, resource, isMeeting(body?.meeting) ? body.meeting : null)
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('POST /api/team failed:', error?.message || error)
    return NextResponse.json({ error: 'Could not add them to your team. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const resourceId = request.nextUrl.searchParams.get('resourceId') || ''
  if (!UUID.test(resourceId)) return NextResponse.json({ error: 'Which service?' }, { status: 400 })
  try {
    const state = await undoAddToTeam(supabase, user.id, resourceId, request.nextUrl.searchParams.get('created') === '1')
    return NextResponse.json({ state })
  } catch (error: any) {
    console.error('DELETE /api/team failed:', error?.message || error)
    return NextResponse.json({ error: 'Could not undo that. Please try again.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ team: {} })
  const ids = (request.nextUrl.searchParams.get('ids') || '').split(',').filter((id) => UUID.test(id)).slice(0, 100)
  return NextResponse.json({ team: await teamStates(supabase, user.id, ids) })
}
