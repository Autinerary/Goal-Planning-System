import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get discovered patterns
    const { data: patterns } = await supabase
      .from('pattern_discoveries')
      .select('*')
      .order('discovered_at', { ascending: false })
      .limit(10)

    // Get top categories
    const { data: resources } = await supabase
      .from('resources')
      .select('category')
      .eq('status', 'approved')

    const categoryCounts = (resources || []).reduce((acc: any, resource: any) => {
      acc[resource.category] = (acc[resource.category] || 0) + 1
      return acc
    }, {})

    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Get top barriers (simplified - would need proper aggregation)
    const { data: barriers } = await supabase
      .from('user_barriers')
      .select('barrier_type')

    const barrierCounts = (barriers || []).reduce((acc: any, barrier: any) => {
      acc[barrier.barrier_type] = (acc[barrier.barrier_type] || 0) + 1
      return acc
    }, {})

    const topBarriers = Object.entries(barrierCounts)
      .map(([barrier, count]) => ({ barrier, count: count as number }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    return NextResponse.json({
      patterns: patterns || [],
      topCategories,
      topBarriers,
      userGrowth: [], // Would calculate from user signups over time
    })
  } catch (error) {
    console.error('Error fetching admin insights:', error)
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 })
  }
}