/**
 * Tidbits as commentaries in ResourceHub's search (the team's notes, October
 * 2026: "Integrate Tidbits AS commentaries (as solutions) ... Tidbits get the
 * Tidbits source"). With Commentaries chosen under Resource Type, or the
 * Tidbits source, published Tidbits that match the search come back beside
 * the listings, each with its key sentence when its writer marked one.
 */
import { getCommunityServiceClient } from '@/lib/community/client'
import { loadGroups } from '@/lib/community/tidbitsServer'
import { markdownExcerpt } from '@/lib/community/markdown'
import { isContentNote } from '@/lib/community/contentNotes'
import { searchWords } from '@/lib/community/tidbits'

export interface TidbitCommentary {
  id: string
  title: string
  /** The first lines, or nothing when the Tidbit has a content note. */
  excerpt: string
  /** The sentence its writer highlighted ("Solutions"). */
  keySentence: string | null
  group: string | null
  byAutinerary: boolean
  lengthType: string | null
  publishedAt: string | null
}

/** Commentaries chosen, or the Tidbits source among the sources chosen. */
export function wantsTidbitCommentaries(categories: readonly string[] = [], sourceTypes: readonly string[] = []): boolean {
  if (sourceTypes.length > 0) return sourceTypes.includes('tidbits')
  return categories.some((c) => c.toLowerCase() === 'commentary')
}

export async function tidbitCommentaries(q: string | undefined, limit = 6): Promise<TidbitCommentary[]> {
  const client = getCommunityServiceClient()
  if (!client) return []
  let query = client
    .from('community_posts')
    .select('id, title, body_markdown, unlocking_moment, content_note, group_id, byline, length_type, published_at')
    .eq('is_deleted', false)
    .eq('kind', 'tidbit')
    .eq('status', 'published')
  // Every word, as the Tidbits feed searches (lib/community/tidbits.ts).
  for (const w of searchWords(q)) query = query.or(`title.ilike.%${w}%,body_markdown.ilike.%${w}%`)
  const { data, error } = await query
    .order('well_done_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) return []
  const groups = await loadGroups(client)
  return ((data || []) as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    excerpt: isContentNote(r.content_note) ? '' : markdownExcerpt(r.body_markdown || '', 200),
    keySentence: isContentNote(r.content_note) ? null : r.unlocking_moment ?? null,
    group: r.group_id ? groups.byId.get(r.group_id)?.name ?? null : null,
    byAutinerary: r.byline === 'autinerary',
    lengthType: r.length_type ?? null,
    publishedAt: r.published_at ?? null,
  }))
}
