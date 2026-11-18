import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orchestrator } from '@/lib/agents/orchestrator'
import { getUserBarriers } from '@/lib/supabase/queries'
import type { RequestType, UserRequest } from '@/lib/agents/orchestrator/types'
import { rateLimited, TOO_MANY_MESSAGE } from '@/lib/rateLimit'

const REQUEST_TYPES: RequestType[] = ['recommendations', 'search', 'validate_submission', 'pattern_discovery']

// Each request can make several paid AI calls (lib/llm.ts).
const PER_10_MINUTES = 30

/**
 * POST /api/orchestrator
 * Main entry point for all agent requests
 * Routes requests to orchestrator and returns combined agent results
 *
 * Signed-in only, and always as the signed-in person: it used to run for
 * anyone and took `userId` from the body, so anyone could run paid AI calls
 * and have the agents' decisions recorded against someone else's account
 * (bug audit, 17 November 2026, item 16).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    // A `userId` in the body is ignored: it is always the signed-in person.
    const requestType = body?.requestType
    const context = body?.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context : {}
    const userId = user.id

    if (!requestType) {
      return NextResponse.json({ error: 'Missing requestType' }, { status: 400 })
    }
    if (!REQUEST_TYPES.includes(requestType)) {
      return NextResponse.json({ error: 'Unknown requestType' }, { status: 400 })
    }

    if (rateLimited('orchestrator', userId, PER_10_MINUTES, 10 * 60_000)) {
      return NextResponse.json({ error: TOO_MANY_MESSAGE }, { status: 429 })
    }

    // Get user barriers if user is authenticated and request needs them
    let barriers: any[] = []
    if (requestType === 'recommendations' || requestType === 'search') {
      const userBarriers = await getUserBarriers(user.id)
      barriers = userBarriers.map((b) => ({
        category: b.barrier_category,
        type: b.barrier_type,
        severity: b.severity || undefined,
        notes: b.notes || undefined,
      }))
    }

    // Build user request
    const userRequest: UserRequest = {
      userId,
      requestType,
      context: {
        ...context,
        isNewUser: false,
      },
      barriers,
    }

    // Handle request through orchestrator
    const result = await orchestrator.handleRequest(userRequest)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in orchestrator API:', error)
    return NextResponse.json(
      {
        error: 'Orchestration failed',
        message: (error as Error).message,
        result: null,
        agentsInvolved: [],
        executionTime: 0,
        agentOutputs: {},
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/orchestrator
 * Get orchestrator status and capabilities
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'active',
    agents: ['RecommendationAgent', 'PatternAgent', 'ValidationAgent', 'SearchService'],
    supportedRequestTypes: ['recommendations', 'search', 'validate_submission', 'pattern_discovery'],
    version: '1.0.0',
  })
}