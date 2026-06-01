import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { orchestrator } from '@/lib/agents/orchestrator'
import { getUserBarriers } from '@/lib/supabase/queries'
import { getUserHistory } from '@/lib/agents/validation-agent/trust-scorer'
import type { UserRequest } from '@/lib/agents/orchestrator/types'

/**
 * POST /api/orchestrator
 * Main entry point for all agent requests
 * Routes requests to orchestrator and returns combined agent results
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Some requests don't require authentication (e.g., public search)
    // But we'll check if userId is provided
    const body = await request.json()
    const { requestType, context, userId: providedUserId } = body

    // Use authenticated user ID or provided user ID
    const userId = user?.id || providedUserId || 'anonymous'

    if (!requestType) {
      return NextResponse.json({ error: 'Missing requestType' }, { status: 400 })
    }

    // Get user barriers if user is authenticated and request needs them
    let barriers: any[] = []
    if (user && (requestType === 'recommendations' || requestType === 'search')) {
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
        isNewUser: user ? false : true, // Determine if new user
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