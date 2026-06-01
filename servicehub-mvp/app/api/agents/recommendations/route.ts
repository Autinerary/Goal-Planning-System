import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recommendationAgent } from '@/lib/agents/recommendation-agent'
import { getUserBarriers } from '@/lib/supabase/queries'
import { getProfile } from '@/lib/supabase/queries'
import type { RecommendationAgentInput } from '@/lib/agents/recommendation-agent/types'
import type { Location } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const context = searchParams.get('context') || undefined

    // Get user barriers
    const userBarriers = await getUserBarriers(user.id)
    if (userBarriers.length === 0) {
      return NextResponse.json({
        resources: [],
        matchScores: [],
        explanations: [],
        confidence: 0,
        message: 'Please complete your profile to get personalized recommendations',
      })
    }

    // Convert to agent input format
    const barriers = userBarriers.map((b) => ({
      category: b.barrier_category,
      type: b.barrier_type,
      severity: b.severity || undefined,
      notes: b.notes || undefined,
    }))

    // Get user location from profile
    const profile = await getProfile(user.id)
    const location = (profile?.location as Location) || undefined

    // Prepare agent input
    const agentInput: RecommendationAgentInput = {
      userId: user.id,
      barriers,
      location,
      context,
    }

    // Generate recommendations
    const result = await recommendationAgent.generateRecommendations(agentInput)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in recommendations API:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        resources: [],
        matchScores: [],
        explanations: [],
        confidence: 0,
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { context, location } = body

    // Get user barriers
    const userBarriers = await getUserBarriers(user.id)
    if (userBarriers.length === 0) {
      return NextResponse.json({
        resources: [],
        matchScores: [],
        explanations: [],
        confidence: 0,
        message: 'Please complete your profile to get personalized recommendations',
      })
    }

    // Convert to agent input format
    const barriers = userBarriers.map((b) => ({
      category: b.barrier_category,
      type: b.barrier_type,
      severity: b.severity || undefined,
      notes: b.notes || undefined,
    }))

    // Use provided location or get from profile
    let userLocation = location
    if (!userLocation) {
      const profile = await getProfile(user.id)
      userLocation = (profile?.location as Location) || undefined
    }

    // Prepare agent input
    const agentInput: RecommendationAgentInput = {
      userId: user.id,
      barriers,
      location: userLocation,
      context,
    }

    // Generate recommendations
    const result = await recommendationAgent.generateRecommendations(agentInput)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in recommendations API:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
        resources: [],
        matchScores: [],
        explanations: [],
        confidence: 0,
      },
      { status: 500 }
    )
  }
}