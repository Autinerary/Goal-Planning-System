import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { patternAgent } from '@/lib/agents/pattern-agent'
import type { PatternAgentInput, PatternScope } from '@/lib/agents/pattern-agent/types'
import { isAdminUser } from '@/lib/auth/admin'
import { cronAuthorized } from '@/lib/cronAuth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SCOPES: PatternScope[] = ['global', 'category', 'location']

/** A scheduled job, or a signed-in admin: the only callers that may start a full discovery run. */
async function mayRunDiscovery(request: NextRequest): Promise<boolean> {
  if (cronAuthorized(request)) return true
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  return isAdminUser(supabase, (profile as { role?: string } | null)?.role)
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const scopeParam = searchParams.get('scope') as PatternScope | null
    const scope: PatternScope = scopeParam && SCOPES.includes(scopeParam) ? scopeParam : 'global'
    const category = searchParams.get('category')?.slice(0, 80) || undefined
    const minimumSupport = searchParams.get('minimumSupport')
      ? Math.max(2, Number(searchParams.get('minimumSupport')) || 2)
      : undefined
    // For resource-specific patterns. Only an id: it goes into a filter below.
    const resourceIdParam = searchParams.get('resourceId')
    if (resourceIdParam && !UUID.test(resourceIdParam)) {
      return NextResponse.json({ patterns: [], cached: false, count: 0 })
    }
    const resourceId = resourceIdParam
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))

    const supabase = createClient()

    // Check if we should return cached patterns or discover new ones. Forcing
    // a fresh run is for admins and the scheduled job only: a run is heavy.
    const forceRefresh = searchParams.get('refresh') === 'true' && (await mayRunDiscovery(request))

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
 *
 * Written as the service: people can't write pattern_discoveries, so with the
 * visitor's session every insert failed, nothing was ever cached and each
 * visit ran discovery again (bug audit, 17 November 2026, item 33). The rows
 * are made here, from the pattern agent's own results, never from a request.
 */
async function storePatterns(patterns: any[]) {
  try {
    const supabase = createAdminClient()

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
    // Admins and the scheduled job only: it used to be open to anyone, and
    // now that it writes as the service it must not be.
    if (!(await mayRunDiscovery(request))) {
      return NextResponse.json({ error: 'Only the team can start pattern discovery.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const scope: PatternScope = SCOPES.includes(body?.scope) ? body.scope : 'global'
    const category = typeof body?.category === 'string' ? body.category.slice(0, 80) : undefined
    const minimumSupport = Math.max(2, Number(body?.minimumSupport) || 5)

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