import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { patternAgent } from '@/lib/agents/pattern-agent'
import type { PatternAgentInput } from '@/lib/agents/pattern-agent/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const scope = (searchParams.get('scope') as any) || 'global'
    const category = searchParams.get('category') || undefined
    const minimumSupport = searchParams.get('minimumSupport')
      ? Number(searchParams.get('minimumSupport'))
      : undefined
    const resourceId = searchParams.get('resourceId') // For resource-specific patterns
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 20

    const supabase = createClient()

    // Check if we should return cached patterns or discover new ones
    const forceRefresh = searchParams.get('refresh') === 'true'

    if (!forceRefresh) {
      // Try to get cached patterns first
      let query = supabase
        .from('pattern_discoveries')
        .select('*')
        .eq('scope', scope)
        .order('discovered_at', { ascending: false })
        .limit(limit)

      if (category) {
        query = query.eq('category', category)
      }

      // Filter by resource if specified
      if (resourceId) {
        // For resource affinity patterns
        query = query.or(`pattern->>'source_resource_id'.eq.${resourceId},pattern->>'related_resource_ids'.cs.["${resourceId}"]`)
      }

      // Only get non-expired patterns
      query = query.or('expires_at.is.null,expires_at.gt.now()')

      const { data: cachedPatterns, error } = await query

      if (!error && cachedPatterns && cachedPatterns.length > 0) {
        // Return cached patterns
        return NextResponse.json({
          patterns: cachedPatterns,
          cached: true,
          count: cachedPatterns.length,
        })
      }
    }

    // Discover new patterns
    const input: PatternAgentInput = {
      scope,
      category,
      minimumSupport,
    }

    const patterns = await patternAgent.discoverPatterns(input)

    // Filter by resource if specified
    let filteredPatterns = patterns
    if (resourceId) {
      filteredPatterns = patterns.filter((p) => {
        const pattern = p.pattern as any
        return (
          pattern.source_resource_id === resourceId ||
          pattern.related_resource_ids?.includes(resourceId) ||
          pattern.resource_ids?.includes(resourceId)
        )
      })
    }

    // Store discovered patterns in database (in background, don't wait)
    if (filteredPatterns.length > 0) {
      storePatterns(filteredPatterns).catch(console.error)
    }

    // Return discovered patterns
    return NextResponse.json({
      patterns: filteredPatterns.slice(0, limit),
      cached: false,
      count: filteredPatterns.length,
    })
  } catch (error) {
    console.error('Error in patterns API:', error)
    return NextResponse.json(
      {
        error: 'Failed to discover patterns',
        patterns: [],
        cached: false,
        count: 0,
      },
      { status: 500 }
    )
  }
}

/**
 * Store discovered patterns in database
 * Runs in background - doesn't block response
 */
async function storePatterns(patterns: any[]) {
  try {
    const supabase = createClient()

    // Prepare patterns for database
    const patternsToStore = patterns.map((pattern) => ({
      type: pattern.type,
      pattern: pattern.pattern,
      frequency: pattern.frequency,
      confidence: pattern.confidence,
      insight: pattern.insight,
      scope: pattern.scope,
      category: pattern.category || null,
      location: pattern.location || null,
      metadata: pattern.metadata || null,
      discovered_at: new Date().toISOString(),
      expires_at: pattern.metadata?.expires_at || null,
    }))

    // Insert patterns (upsert to avoid duplicates)
    const { error } = await supabase.from('pattern_discoveries').upsert(patternsToStore, {
      onConflict: 'insight', // Use insight as unique identifier
      ignoreDuplicates: true,
    })

    if (error) {
      console.error('Error storing patterns:', error)
    }
  } catch (error) {
    console.error('Error storing patterns:', error)
  }
}

/**
 * Trigger pattern discovery job
 * Can be called manually or by cron job
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // For now, anyone can trigger (in production, restrict to admins)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const body = await request.json().catch(() => ({}))
    const { scope = 'global', category, minimumSupport = 5 } = body

    const input: PatternAgentInput = {
      scope,
      category,
      minimumSupport,
    }

    // Discover patterns
    const patterns = await patternAgent.discoverPatterns(input)

    // Store patterns
    await storePatterns(patterns)

    return NextResponse.json({
      success: true,
      patternsDiscovered: patterns.length,
      patterns: patterns.slice(0, 10), // Return top 10 for preview
    })
  } catch (error) {
    console.error('Error triggering pattern discovery:', error)
    return NextResponse.json({ error: 'Failed to discover patterns' }, { status: 500 })
  }
}