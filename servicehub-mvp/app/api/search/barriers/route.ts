import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Get all distinct barrier types from user_barriers table
 * Used for filter options in search
 * Uses service role key to bypass RLS and get all barrier types
 */
export async function GET() {
  try {
    // Use service role key to bypass RLS and get all barrier types for filters
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all distinct barrier types
    const { data, error } = await supabase
      .from('user_barriers')
      .select('barrier_type, barrier_category')
      .order('barrier_category', { ascending: true })
      .order('barrier_type', { ascending: true })

    if (error) {
      console.error('Error fetching barrier types:', error)
      return NextResponse.json({ error: 'Failed to fetch barrier types' }, { status: 500 })
    }

    // Group by category
    const barriersByCategory: { [category: string]: string[] } = {}
    const seenTypes = new Set<string>()

    data?.forEach((barrier) => {
      const category = barrier.barrier_category || 'other'
      const type = barrier.barrier_type

      if (!seenTypes.has(type)) {
        if (!barriersByCategory[category]) {
          barriersByCategory[category] = []
        }
        barriersByCategory[category].push(type)
        seenTypes.add(type)
      }
    })

    // Format response with human-readable labels
    const categoryLabels: { [key: string]: string } = {
      neurodivergence: 'Neurodivergence',
      disability: 'Disabilities',
      identity: 'Identity & Background',
      health: 'Health',
    }

    const formattedCategories = Object.entries(barriersByCategory).map(([category, types]) => ({
      category,
      label: categoryLabels[category] || category,
      barriers: types.map((type) => ({
        id: type,
        label: type
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
      })),
    }))

    return NextResponse.json(formattedCategories)
  } catch (error) {
    console.error('Error in barriers API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
