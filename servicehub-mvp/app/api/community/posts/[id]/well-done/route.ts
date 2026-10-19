/**
 * /api/community/posts/[id]/well-done — a Well-Done: the signed-in person
 * rates someone else's Tidbit, 1 to 5 (the Tidbits round's planning note,
 * Goal 3: "Well-Dones are what we call posts that have been rated by the
 * user").
 *   POST   { rating } — give or change it; `first` for the animation and sound
 *   DELETE            — take it back
 * The database counts them and refuses your own Tidbit, a question or a
 * draft (STEP 83's community_post_ratings).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCommunityServiceClient, getCommunityViewer } from '@/lib/community/client'
import { step83Missing } from '@/lib/community/tidbits'

export const dynamic = 'force-dynamic'

async function counts(client: NonNullable<ReturnType<typeof getCommunityServiceClient>>, id: string) {
  const { data } = await client.from('community_posts').select('well_done_count, well_done_sum').eq('id', id).maybeSingle()
  const n = data?.well_done_count ?? 0
  return { well_done_count: n, well_done_avg: n ? Math.round((data!.well_done_sum / n) * 10) / 10 : null }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const client = getCommunityServiceClient()
  if (!client) return NextResponse.json({ error: 'Community is not configured' }, { status: 503 })
  const viewer = await getCommunityViewer()
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const rating = Math.round(Number(body?.rating))
  if (!(rating >= 1 && rating <= 5)) return NextResponse.json({ error: 'Choose 1 to 5.' }, { status: 400 })

  const { data: before, error: readError } = await client
    .from('community_post_ratings')
    .select('rating')
    .eq('post_id', params.id)
    .eq('user_id', viewer.user_id)
    .maybeSingle()
  if (readError && step83Missing(readError)) return NextResponse.json({ error: 'Well-Dones open soon.' }, { status: 503 })

  const { error } = await client
    .from('community_post_ratings')
    .upsert({ post_id: params.id, user_id: viewer.user_id, rating }, { onConflict: 'post_id,user_id' })
  if (error) {
    if ((error as any).hint === 'not_rateable') {
      return NextResponse.json({ error: 'You can give a Well-Done to someone else’s published Tidbit.' }, { status: 400 })
    }
    console.error('[community] well-done failed:', error.message)
    return NextResponse.json({ error: 'Could not save that.' }, { status: 500 })
  }
  return NextResponse.json({ first: !before, rating, ...(await counts(client, params.id)) })
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const client = getCommunityServiceClient()
  if (!client) return NextResponse.json({ error: 'Community is not configured' }, { status: 503 })
  const viewer = await getCommunityViewer()
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })
  await client.from('community_post_ratings').delete().eq('post_id', params.id).eq('user_id', viewer.user_id)
  return NextResponse.json({ ok: true, ...(await counts(client, params.id)) })
}
