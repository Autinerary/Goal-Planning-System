/**
 * POST /api/community/posts/[id]/bite — a Bite: the signed-in person read
 * this Tidbit to the end (the Tidbits round's planning note, Goal 3: "A Bite
 * is what we call an article read by the user"). Once per person (STEP 83's
 * community_post_reads); `first` says whether this was their first Bite of
 * it, for the animation and the sound.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCommunityServiceClient, getCommunityViewer } from '@/lib/community/client'
import { step83Missing } from '@/lib/community/tidbits'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const client = getCommunityServiceClient()
  if (!client) return NextResponse.json({ error: 'Community is not configured' }, { status: 503 })
  const viewer = await getCommunityViewer()
  if (!viewer) return NextResponse.json({ error: 'Sign-in required' }, { status: 401 })

  const { data: post, error } = await client
    .from('community_posts')
    .select('id, kind, status, is_deleted, author_id')
    .eq('id', params.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: step83Missing(error) ? 'Bites open soon.' : 'Could not record that.' }, { status: step83Missing(error) ? 503 : 500 })
  if (!post || post.is_deleted || post.status !== 'published' || post.kind !== 'tidbit') {
    return NextResponse.json({ error: 'Tidbit not found' }, { status: 404 })
  }
  // Reading your own isn't a Bite.
  if (post.author_id === viewer.user_id) return NextResponse.json({ first: false, own: true })

  const { error: insertError } = await client.from('community_post_reads').insert({ post_id: post.id, user_id: viewer.user_id })
  const first = !insertError
  if (insertError && insertError.code !== '23505') {
    console.error('[community] bite failed:', insertError.message)
    return NextResponse.json({ error: 'Could not record that.' }, { status: 500 })
  }
  const { data: counts } = await client.from('community_posts').select('bite_count').eq('id', post.id).maybeSingle()
  return NextResponse.json({ first, bite_count: counts?.bite_count ?? null })
}
