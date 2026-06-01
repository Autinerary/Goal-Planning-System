import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateProfile, addUserBarrier } from '@/lib/supabase/queries'
import { generateUserEmbeddingJob } from '@/lib/embeddings/background-jobs'

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

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: OnboardingData = await request.json()

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
          severity: barrier.severity || null,
          notes: barrier.notes || null,
        })
      )
    )

    // Check if all barriers were added successfully
    const failedBarriers = barrierResults.filter((result) => result === null)
    if (failedBarriers.length > 0) {
      console.error(`Failed to add ${failedBarriers.length} barriers`)
      // Continue anyway - we'll regenerate embeddings with whatever was saved
    }

    // Verify at least one barrier was saved successfully
    // This ensures the database transaction is committed before returning
    const successfulBarriers = barrierResults.filter((r) => r !== null)
    if (successfulBarriers.length === 0) {
      return NextResponse.json(
        { error: 'Failed to save barriers' },
        { status: 500 }
      )
    }

    // Generate user embedding in background (non-blocking)
    // This captures the full intersectional profile
    // Fire and forget - don't wait for it to complete
    setImmediate(() => {
      generateUserEmbeddingJob(user.id).catch((error) => {
        console.error('Error generating user embedding:', error)
        // Don't fail the onboarding if embedding generation fails
      })
    })

    return NextResponse.json({
      message: 'Onboarding completed successfully',
      userId: user.id,
      barriersAdded: barrierResults.filter((r) => r !== null).length,
    })
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
