import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Must read the live DB at request time, not be prerendered at build time.
export const dynamic = 'force-dynamic'

/**
 * GET /api/path-categories — the Path Market's life categories, moved out of
 * hardcoded page.tsx into the editable `path_categories` table (Odosa). Public
 * browse taxonomy, ordered by sort_order. Uses the anon client (RLS allows
 * read-all) so it works signed-out.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return NextResponse.json({ categories: [] })
  }

  const supabase = createClient(url, anon)
  const { data, error } = await supabase
    .from('path_categories')
    .select(
      'key, title, blurb, icon, tint, icon_tint, focus_category, examples, foundations_description, foundations_seed_goals, foundations_status, sort_order'
    )
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('[path-categories] read failed:', error.message)
    return NextResponse.json({ categories: [] })
  }

  const categories = (data || []).map((r: any) => ({
    key: r.key,
    title: r.title,
    blurb: r.blurb,
    icon: r.icon || 'Sparkles',
    tint: r.tint,
    iconTint: r.icon_tint,
    focusCategory: r.focus_category,
    examples: Array.isArray(r.examples) ? r.examples : [],
    foundations: {
      description: r.foundations_description || '',
      seedGoals: Array.isArray(r.foundations_seed_goals) ? r.foundations_seed_goals : [],
      status: r.foundations_status === 'coming' ? 'coming' : 'live',
    },
  }))

  return NextResponse.json({ categories })
}
