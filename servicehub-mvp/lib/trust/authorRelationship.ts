import { createAdminClient } from '@/lib/supabase/admin'
import { weightFor, type Relationship } from '@/lib/trust/relationship'

/**
 * Snapshot an author's relationship to their norms, for Tidbits posts/answers.
 *
 * Mirrors the ratings path: taken at write time because RLS blocks reading
 * other users' profiles when rendering, and because a post should keep the
 * standing its author had when they wrote it.
 */
export async function authorRelationshipSnapshot(userId: string): Promise<{
  relationships: Record<string, string>
  weight: number
}> {
  const fallback = { relationships: {}, weight: 1.0 }
  if (!userId) return fallback
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('user_barriers')
      .select('barrier_type, relationship')
      .eq('user_id', userId)

    const relationships: Record<string, string> = {}
    for (const b of data || []) {
      const type = String((b as any).barrier_type || '').trim().toLowerCase()
      if (type) relationships[type] = String((b as any).relationship || 'lived')
    }

    const values = Object.values(relationships)
    // Strongest tie wins — lived experience of one norm shouldn't be demoted
    // because the author is also an ally to another.
    const weight = values.length
      ? Math.max(...values.map((r) => weightFor(r)))
      : 1.0

    return { relationships, weight }
  } catch {
    // Never block posting on this.
    return fallback
  }
}

/** The strongest relationship in a snapshot, for the display badge. */
export function primaryRelationship(
  relationships: Record<string, string> | null | undefined
): Relationship | null {
  const values = Object.values(relationships || {}).filter((r) => typeof r === 'string')
  if (values.length === 0) return null
  return values.reduce((a, b) => (weightFor(b) > weightFor(a) ? b : a)) as Relationship
}
