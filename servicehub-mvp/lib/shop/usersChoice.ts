import { createClient } from '@/lib/supabase/server'
import { NORM_GROUPS } from '@/lib/norms/taxonomy'

/**
 * Users' Choice (the team's planning note, products round, Goal 8: "the
 * highest rated item for each type of user, as a tag alongside Community's
 * Choice"), for every kind of item. STEP 82's users_choice_build() works it
 * out each month: per kind and category, the item rated highest (at least 4,
 * from at least three ratings) by people who share a norm, or by people with
 * the same connection to a norm. This reads the newest month.
 */

export interface UsersChoice {
  userType: string
  label: string
  average: number
  ratings: number
}

const CONNECTIONS: Record<string, string> = {
  lived: 'people with lived experience',
  direct_support: 'families',
  indirect_support: 'professionals',
  ally: 'allies',
}

const NORM_LABELS = new Map<string, string>()
for (const g of NORM_GROUPS) for (const n of g.norms) NORM_LABELS.set(n.id.toLowerCase(), n.label)

/** "Top rated by families", "Top rated by people who share ADHD". */
export function usersChoiceLabel(userType: string): string {
  const [kind, key] = userType.split(':')
  if (kind === 'connection') return `Top rated by ${CONNECTIONS[key] || key.replace(/_/g, ' ')}`
  const norm = NORM_LABELS.get(key) || NORM_LABELS.get(key.replace(/_/g, ' ')) || key.replace(/_/g, ' ')
  return `Top rated by people who share ${norm}`
}

/** The newest month's Users' Choice for these items (empty before STEP 82 or before any). */
export async function usersChoiceFor(kind: 'service' | 'product' | 'article', ids: string[]): Promise<Map<string, UsersChoice[]>> {
  const out = new Map<string, UsersChoice[]>()
  if (!ids.length) return out
  const supabase = createClient()
  const { data: latest, error } = await supabase.from('users_choice').select('period').order('period', { ascending: false }).limit(1)
  if (error || !latest?.length) return out
  const { data } = await supabase
    .from('users_choice')
    .select('item_id, user_type, average, ratings')
    .eq('period', latest[0].period)
    .eq('kind', kind)
    .in('item_id', ids.slice(0, 300))
  for (const r of data || []) {
    const list = out.get(r.item_id) || []
    list.push({ userType: r.user_type, label: usersChoiceLabel(r.user_type), average: Number(r.average), ratings: r.ratings })
    out.set(r.item_id, list)
  }
  return out
}
