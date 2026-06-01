import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateProfile, addUserBarrier } from '@/lib/supabase/queries'
import { generateUserEmbeddingJob } from '@/lib/embeddings/background-jobs'
import { orchestrator } from '@/lib/agents/orchestrator'
import type { UserRequest } from '@/lib/agents/orchestrator/types'
import type { Location } from '@/types/database'

interface OnboardingData {
  role: string | null
  location: {
    city: string
    province: string
    country: string
  }
  barriers: Array<{
    id: string
    label: string
    category: string
    categoryLabel: string
    severity?: number
    notes?: string
  }>
  lifeStage: string
  goals: string[]
  culturalNotes: string
  additionalNotes: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Check authentication - but allow unauthenticated users for Goal Planning integration
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    const body: OnboardingData = await request.json()
    
    // If no user, we'll still process the data but won't persist it
    // This allows Goal Planning to get recommendations without requiring ServiceHub login
    const isAuthenticated = !authError && user !== null

    // Validate required fields
    if (!body.role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 })
    }

    if (!body.location.city || !body.location.province || !body.location.country) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    if (!body.barriers || body.barriers.length === 0) {
      return NextResponse.json(
        { error: 'At least one barrier must be selected' },
        { status: 400 }
      )
    }

    if (!body.lifeStage || !body.goals || body.goals.length === 0) {
      return NextResponse.json(
        { error: 'Life stage and goals are required' },
        { status: 400 }
      )
    }

    // Convert barriers to agent format
    const barriers = body.barriers.map((b) => ({
      category: b.category,
      type: b.id,
      severity: b.severity || undefined,
      notes: b.notes || undefined,
    }))

    // Convert location to Location type
    const location: Location = {
      city: body.location.city,
      province: body.location.province,
      country: body.location.country,
      address: '',
      lat: 0,
      lng: 0,
      postal_code: '',
    }

    // Only persist data if user is authenticated
    let userId = user?.id || 'anonymous'
    let barriersAdded = 0

    if (isAuthenticated && user) {
      // Update user profile
      const profileUpdate = await updateProfile(user.id, {
        role: body.role as any,
        location: body.location,
      })

      if (!profileUpdate) {
        return NextResponse.json(
          { error: 'Failed to update profile' },
          { status: 500 }
        )
      }

      // Add all barriers
      const barrierResults = await Promise.all(
        body.barriers.map((barrier) =>
          addUserBarrier({
            user_id: user.id,
            barrier_category: barrier.category,
            barrier_type: barrier.id,
            severity: barrier.severity,
            notes: barrier.notes,
          })
        )
      )

      barriersAdded = barrierResults.filter((r) => r !== null).length

      // Generate user embedding in background (non-blocking)
      setImmediate(() => {
        generateUserEmbeddingJob(user.id).catch((error) => {
          console.error('Error generating user embedding:', error)
        })
      })
    } else {
      // Log data for unauthenticated users (for analytics/debugging)
      console.log('Onboarding data received from unauthenticated user:', {
        role: body.role,
        location: body.location,
        barriersCount: body.barriers.length,
        lifeStage: body.lifeStage,
        goalsCount: body.goals.length,
      })
    }

    // Generate AI recommendations using orchestrator
    let recommendations: any[] = []
    let recommendationExplanation = ''
    let recommendationConfidence = 0

    try {
      const userRequest: UserRequest = {
        userId: userId,
        requestType: 'recommendations',
        context: {
          location,
          isNewUser: true,
          needsDeepInsights: true,
        },
        barriers,
      }

      const orchestrationResult = await orchestrator.handleRequest(userRequest)
      const recommendationOutput = orchestrationResult.agentOutputs.RecommendationAgent

      if (recommendationOutput && recommendationOutput.resources) {
        recommendations = recommendationOutput.resources.slice(0, 12) // Top 12 recommendations
        recommendationExplanation = orchestrationResult.explanation || recommendationOutput.explanations?.[0] || ''
        recommendationConfidence = recommendationOutput.confidence || orchestrationResult.metadata?.synthesis?.confidence || 0
      }
    } catch (error) {
      console.error('Error generating recommendations:', error)
      // Continue without recommendations - don't fail the onboarding
    }

    return NextResponse.json({
      message: isAuthenticated 
        ? 'Onboarding completed successfully' 
        : 'Onboarding data received. Sign in to ServiceHub to save your profile and get personalized recommendations.',
      userId: userId,
      barriersAdded,
      recommendations: recommendations.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        category: r.category,
        location: r.location,
        averageRating: r.averageRating || 0,
        ratingCount: r.ratingCount || 0,
        score: r.score || 0,
        explanation: r.explanation || '',
      })),
      recommendationExplanation,
      recommendationConfidence,
      requiresAuth: !isAuthenticated,
    })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
