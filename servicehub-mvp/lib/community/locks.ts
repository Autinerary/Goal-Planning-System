/**
 * A locked post is read-only: no new votes (on it or its answers), no new
 * answers and no edits to its answers, except by moderators. The lock used to
 * be honoured only by new answers, so a locked post still took votes (bug
 * audit, 17 November 2026, items 13 and 33).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { step83Missing } from './tidbits'

export const LOCKED_MESSAGE = "This post is locked, so it can't take new votes, answers or edits."

export interface PostState {
  id: string
  author_id: string
  is_locked: boolean
  is_deleted: boolean
  /** 'published' or 'draft'; before STEP 83 every post is published. */
  status: string
}

/** A post's state, read as the service; null when there is no such post. */
export async function loadPostState(client: SupabaseClient, postId: string): Promise<PostState | null> {
  let { data, error } = (await client
    .from('community_posts')
    .select('id, author_id, is_locked, is_deleted, status')
    .eq('id', postId)
    .maybeSingle()) as { data: any; error: any }
  if (error && step83Missing(error)) {
    ;({ data, error } = (await client
      .from('community_posts')
      .select('id, author_id, is_locked, is_deleted')
      .eq('id', postId)
      .maybeSingle()) as { data: any; error: any })
  }
  if (error || !data) return null
  return {
    id: data.id,
    author_id: data.author_id,
    is_locked: !!data.is_locked,
    is_deleted: !!data.is_deleted,
    status: data.status ?? 'published',
  }
}

/** The post an answer belongs to, read as the service; null when there is no such answer. */
export async function loadAnswerPost(
  client: SupabaseClient,
  answerId: string
): Promise<{ answer: { id: string; author_id: string; is_deleted: boolean }; post: PostState | null } | null> {
  const { data, error } = await client
    .from('community_answers')
    .select('id, post_id, author_id, is_deleted')
    .eq('id', answerId)
    .maybeSingle()
  if (error || !data) return null
  return {
    answer: { id: data.id, author_id: data.author_id, is_deleted: !!data.is_deleted },
    post: await loadPostState(client, data.post_id),
  }
}
